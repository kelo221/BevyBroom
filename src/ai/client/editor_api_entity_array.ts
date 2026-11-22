import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { entityOwnerIs } from '@/entity/model/entity_owner_keys.js';
import { CommandEntityArrayBake } from '@/entity_array/commands/command_entity_array_bake.js';
import { CommandEntityArraySet } from '@/entity_array/commands/command_entity_array_set.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { type EntityArraySettings, EntityArraySettingsRules } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';

/** Arguments of set_entity_array. */
interface EntityArraySetArgs {
  readonly id: string;
  readonly array: Record<string, unknown> | null;
}

/** Makes entities repeat and bakes their copies. */
export class EditorApiEntityArray {
  private readonly host: EditorApiHost;

  /**
   * Creates the array tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs an array tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no array tool.
   */
  entityArrayToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'set_entity_array':
        return this.arraySet(args as unknown as EntityArraySetArgs);
      case 'bake_entity_array':
        return this.arrayBake(String(args['id']));
      default:
        return null;
    }
  }

  /**
   * Makes an entity repeat with partial settings over its current or default
   * ones, or stops it repeating.
   *
   * @param args Entity id and partial settings or null.
   * @returns Result with the settings and copy ids.
   */
  private arraySet(args: EntityArraySetArgs): McpToolResult {
    const source = this.sourceFind(args.id);
    if (source === null) {
      return failResult(`No entity that can repeat has id ${args.id}`);
    }
    const settings = EditorApiEntityArray.settingsMerge(EntityArrayStore.read(source), args.array);
    if (settings === undefined) {
      return failResult('array must be an object or null');
    }
    const command = new CommandEntityArraySet([source], () => settings);
    if (command.hasChanges()) {
      this.host.commandStack.push(command);
      this.host.refreshAfterWorldMutation();
    }
    return okResult(`${source.name} ${settings === null ? 'no longer repeats' : 'repeats'}`, {
      id: source.uuid,
      array: settings === null ? null : EntityArraySettingsRules.toFieldValues(settings),
      copyIds: EntityArrayCopyMark.copiesOf(source).map((copy) => copy.uuid),
    });
  }

  /**
   * Bakes the copies of an entity into ordinary entities beside it.
   *
   * @param id Source entity id.
   * @returns Result with the baked entity ids.
   */
  private arrayBake(id: string): McpToolResult {
    const source = this.sourceFind(id);
    const copyIds = source === null ? [] : EntityArrayCopyMark.copiesOf(source).map((copy) => copy.uuid);
    const command = source === null ? null : new CommandEntityArrayBake([source]);
    if (source === null || command === null || !command.hasChanges()) {
      return failResult(`No repeating entity has id ${id}`);
    }
    this.host.commandStack.push(command);
    this.host.refreshAfterWorldMutation();
    return okResult(`Baked ${copyIds.length} copies of ${source.name}`, { id: source.uuid, bakedIds: copyIds });
  }

  /**
   * Returns the entity with an id when it may repeat.
   *
   * @param id Object uuid.
   * @returns An entity owner that is no array copy, or null.
   */
  private sourceFind(id: string): THREE.Object3D | null {
    const object = this.host.worldObject.getObjectByProperty('uuid', id) ?? null;
    return object !== null && entityOwnerIs(object) && !EntityArrayCopyMark.is(object) ? object : null;
  }

  /**
   * Merges partial array settings over current or default ones.
   *
   * @param current Current settings, or null when the entity does not repeat.
   * @param patch Partial settings, or null to stop repeating.
   * @returns New settings, null to stop repeating, or undefined for a patch
   *   that is neither an object nor null.
   */
  private static settingsMerge(
    current: EntityArraySettings | null,
    patch: unknown,
  ): EntityArraySettings | null | undefined {
    if (patch === null) {
      return null;
    }
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      return undefined;
    }
    const base = EntityArraySettingsRules.toFieldValues(current ?? EntityArraySettingsRules.createDefault());
    return EntityArraySettingsRules.fromUnknown({ ...base, ...(patch as Record<string, unknown>) }) ?? undefined;
  }
}
