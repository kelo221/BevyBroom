import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { EditorApiClipboard } from './editor_api_clipboard.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';
import { CommandPrefabTemplateAdd } from '@/prefab/commands/command_prefab_template_add.js';
import { CommandPrefabTemplateRemove } from '@/prefab/commands/command_prefab_template_remove.js';
import { CommandPrefabTemplateUpdate } from '@/prefab/commands/command_prefab_template_update.js';
import { getPrefabCatalogStore, type PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';

/** Names of the prefab tools. */
export const EDITOR_API_PROJECT_PREFAB_TOOL_NAMES: readonly string[] = Object.freeze([
  'list_prefabs',
  'create_prefab',
  'place_prefab',
  'update_prefab',
  'delete_prefab',
]);

/**
 * Lists, creates, places and deletes prefabs; project prefabs are files of the
 * project.
 */
export class EditorApiProjectPrefabs {
  private readonly host: EditorApiHost;
  private readonly clipboard: EditorApiClipboard;
  private readonly store: PrefabCatalogStore;

  /**
   * Creates the prefab tools.
   *
   * @param host Live editor systems.
   * @param store Prefab catalog; the shared one by default.
   */
  constructor(host: EditorApiHost, store: PrefabCatalogStore = getPrefabCatalogStore()) {
    this.host = host;
    this.clipboard = new EditorApiClipboard(host);
    this.store = store;
  }

  /**
   * Runs a prefab tool.
   *
   * @param name Tool name.
   * @param args Argument object.
   * @returns Result, or null when the name is not a prefab tool.
   */
  prefabToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'list_prefabs':
        return this.prefabsList();
      case 'create_prefab':
        return this.prefabCreate(args);
      case 'place_prefab':
        return this.prefabPlace(args);
      case 'update_prefab':
        return this.prefabUpdate(args);
      case 'delete_prefab':
        return this.prefabDelete(args);
      default:
        return null;
    }
  }

  /**
   * Lists every prefab with its category and whether it is a project file.
   *
   * @returns Result with the prefabs.
   */
  private prefabsList(): McpToolResult {
    const prefabs = this.store.templatesRead().map((template) => this.prefabSummaryCreate(template));
    return okResult(`${prefabs.length} prefab(s)`, { prefabs });
  }

  /**
   * Captures the selection as a new prefab as one undoable step.
   *
   * @param args Argument object with name and optional category.
   * @returns Result with the new prefab.
   */
  private prefabCreate(args: Record<string, unknown>): McpToolResult {
    const name = typeof args['name'] === 'string' ? args['name'].trim() : '';
    if (name === '') {
      return failResult('create_prefab needs a name');
    }
    const category = typeof args['category'] === 'string' ? args['category'] : '';
    const roots = this.clipboard.controllerRead().selectionRootsRead();
    const template = this.store.templateCapture(name, category, roots);
    if (template === null) {
      return failResult('Nothing to capture: select objects first');
    }
    this.host.commandStack.push(new CommandPrefabTemplateAdd(this.store, template));
    return okResult(`Created prefab ${template.id}`, this.prefabSummaryCreate(template));
  }

  /**
   * Places a copy of a prefab as one undoable step, by default where it was
   * captured, or with the bottom centre of its bounds at a position.
   *
   * @param args Argument object with prefabId and optional position.
   * @returns Result with the ids of the placed objects.
   */
  private prefabPlace(args: Record<string, unknown>): McpToolResult {
    const prefabId = typeof args['prefabId'] === 'string' ? args['prefabId'] : '';
    const payload = this.store.placementPayloadRead(prefabId, true);
    if (payload === null) {
      return failResult(`No prefab ${prefabId}; call list_prefabs`);
    }
    const offset = this.placementOffsetCompute(payload, args['position']);
    const pasted = this.clipboard.controllerRead().payloadPaste(payload, offset);
    return okResult(`Placed ${pasted.ids.length} object(s)`, { ids: pasted.ids }, { createdIds: pasted.ids });
  }

  /**
   * Renames a prefab or changes its category as one undoable step.
   *
   * @param args Argument object with prefabId and optional name and category.
   * @returns Result with the changed prefab.
   */
  private prefabUpdate(args: Record<string, unknown>): McpToolResult {
    const prefabId = typeof args['prefabId'] === 'string' ? args['prefabId'] : '';
    const template = this.store.templateFind(prefabId);
    if (template === null) {
      return failResult(`No prefab ${prefabId}; call list_prefabs`);
    }
    const name = EditorApiProjectPrefabs.textArgumentRead(args['name']) ?? template.name;
    const category = EditorApiProjectPrefabs.textArgumentRead(args['category']) ?? template.category;
    const changed = { ...template, name, category };
    this.host.commandStack.push(new CommandPrefabTemplateUpdate(this.store, template, changed));
    return okResult(`Updated prefab ${prefabId}`, this.prefabSummaryCreate(changed));
  }

  /**
   * Reads a non-blank text argument.
   *
   * @param value Untrusted argument.
   * @returns Trimmed text, or null when the argument is missing or blank.
   */
  private static textArgumentRead(value: unknown): string | null {
    const text = typeof value === 'string' ? value.trim() : '';
    return text === '' ? null : text;
  }

  /**
   * Deletes a prefab, and its project file, as one undoable step.
   *
   * @param args Argument object with prefabId.
   * @returns Result naming the deleted prefab.
   */
  private prefabDelete(args: Record<string, unknown>): McpToolResult {
    const prefabId = typeof args['prefabId'] === 'string' ? args['prefabId'] : '';
    const template = this.store.templateFind(prefabId);
    if (template === null) {
      return failResult(`No prefab ${prefabId}; call list_prefabs`);
    }
    this.host.commandStack.push(new CommandPrefabTemplateRemove(this.store, template));
    return okResult(`Deleted prefab ${prefabId}`);
  }

  /**
   * Computes the offset that puts the bottom centre of a payload's bounds at a
   * position.
   *
   * @param payload Payload at its captured position.
   * @param position Untrusted {x, y, z} argument; anything else keeps the
   *   captured position.
   * @returns World offset.
   */
  private placementOffsetCompute(payload: ClipboardPayload, position: unknown): THREE.Vector3 {
    if (typeof position !== 'object' || position === null) {
      return new THREE.Vector3();
    }
    const { x, y, z } = position as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return new THREE.Vector3();
    }
    const { min, max } = payload.bounds;
    const bottomCentre = new THREE.Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2);
    return new THREE.Vector3(x, y, z).sub(bottomCentre);
  }

  /**
   * Builds the listed facts of a prefab.
   *
   * @param template Prefab.
   * @returns Id, name, category, object and brush counts, and whether it is a
   *   project file.
   */
  private prefabSummaryCreate(template: PrefabTemplate): Record<string, unknown> {
    return {
      id: template.id,
      name: template.name,
      category: template.category,
      objectCount: template.payload.objects.length,
      brushCount: template.payload.brushes.brushes.length,
      isProjectFile: this.store.isPersisted(template.id),
    };
  }
}
