import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { editorApiModifierStackApply } from './editor_api_modifier_stack_parse.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { CommandModifierVolumeCreate } from '@/modifier/stack/command_modifier_volume_create.js';
import { CommandModifierStackSet } from '@/modifier/stack/command_modifier_stack_set.js';
import { CommandModifierVolumeBake } from '@/modifier/stack/bake/command_modifier_volume_bake.js';
import { modifierStackStatusRead } from '@/modifier/stack/evaluate/modifier_stack_status.js';
import { modifierStackOperationIssue } from '@/modifier/stack/evaluate/modifier_stack_operation_issue.js';
import { modifierStackKinds } from '@/modifier/stack/modifier_stack_catalog.js';
import type { ModifierStackField } from '@/modifier/stack/modifier_stack_types.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierVolumeTemplateCreate, modifierVolumeTemplates } from '@/modifier/stack/modifier_volume_templates.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { isSolidCsgGroup } from '@/solid/model/solid_group.js';
import { entityOwnerIs } from '@/entity/model/entity_owner_keys.js';

/** Box size of a volume whose call names none. */
const EDITOR_API_MODIFIER_VOLUME_DEFAULT_SIZE = 1;

/** Creates, reads, edits and bakes modifier volumes, and lists modifier kinds. */
export class EditorApiModifierVolumes {
  /**
   * Creates the modifier volume tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a modifier volume tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no modifier volume tool.
   */
  modifierVolumeToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'list_modifier_kinds':
        return this.modifierKindsList();
      case 'add_modifier_volume':
        return this.modifierVolumeAdd(args);
      case 'get_modifier_stack':
        return this.withVolume(args, (volume) => this.modifierStackDescribe(volume, 'Modifier stack'));
      case 'set_modifier_stack':
        return this.withVolume(args, (volume) => this.modifierStackSet(volume, args));
      case 'bake_modifier_volume':
        return this.withVolume(args, (volume) => this.modifierVolumeBake(volume));
      default:
        return null;
    }
  }

  /**
   * Lists the installed kinds with their fields and starting parameters, and
   * the Add menu templates.
   *
   * @returns Result with kinds and templates.
   */
  private modifierKindsList(): McpToolResult {
    const kinds = modifierStackKinds.map((kind) => ({
      id: kind.id,
      label: kind.label,
      category: kind.category,
      description: kind.description,
      fields: kind.fields.map((field) => editorApiModifierFieldDescribe(field)),
      defaultParameters: kind.normalizeParameters(kind.createParameters()),
    }));
    return okResult(`${kinds.length} modifier kinds`, { kinds, templates: modifierVolumeTemplates });
  }

  /**
   * Creates a volume from a template and the call's stack settings as one undo
   * step, then selects it.
   *
   * @param args Tool arguments.
   * @returns Result describing the new volume.
   */
  private modifierVolumeAdd(args: Record<string, unknown>): McpToolResult {
    const parent = this.parentResolve(args['parentId']);
    if (typeof parent === 'string') return failResult(parent);
    const size = editorApiModifierVolumeSize(args['size']);
    if (typeof size === 'string') return failResult(size);
    const template = typeof args['template'] === 'string' ? args['template'] : 'empty';
    const volume = modifierVolumeTemplateCreate(template, new THREE.BoxGeometry(size.x, size.y, size.z));
    const stack = editorApiModifierStackApply(ModifierVolume.read(volume), args);
    if (typeof stack === 'string') return failResult(stack);
    ModifierVolume.write(volume, stack);
    if (typeof args['name'] === 'string' && args['name'].trim() !== '') volume.name = args['name'];
    this.volumePlace(volume, parent, args['center']);
    this.host.commandStack.push(new CommandModifierVolumeCreate(volume, parent));
    this.host.selectionManager.selectObject(volume);
    this.worldRefresh();
    return this.modifierStackDescribe(volume, `Created ${volume.name}`, [volume.uuid]);
  }

  /**
   * Sets a volume's stack from the call's settings as one undo step.
   *
   * @param volume Modifier volume.
   * @param args Tool arguments.
   * @returns Result describing the edited volume.
   */
  private modifierStackSet(volume: THREE.Object3D, args: Record<string, unknown>): McpToolResult {
    const before = ModifierVolume.read(volume);
    const after = editorApiModifierStackApply(before, args);
    if (typeof after === 'string') return failResult(after);
    this.host.commandStack.push(new CommandModifierStackSet(volume, before, after));
    this.worldRefresh();
    return this.modifierStackDescribe(volume, `Updated ${volume.name}`);
  }

  /**
   * Bakes a volume into brushes as one undo step.
   *
   * @param volume Modifier volume.
   * @returns Result with the created brush ids.
   */
  private modifierVolumeBake(volume: THREE.Object3D): McpToolResult {
    const command = new CommandModifierVolumeBake(volume);
    this.host.commandStack.push(command);
    this.host.selectionManager.pruneSelectionNotInScene(this.host.worldObject);
    this.worldRefresh();
    const createdBrushIds = command.createdBrushIds();
    return okResult(
      `Baked ${volume.name} into ${createdBrushIds.length} brushes`,
      { createdBrushIds },
      {
        createdIds: createdBrushIds,
      },
    );
  }

  /**
   * Describes a volume's stack and the feedback of its last evaluation.
   *
   * @param volume Modifier volume.
   * @param message Result message.
   * @param createdIds Ids to report as created, if any.
   * @returns Result with id, name, stack, status, and the reason a boolean
   *   operation writes no box (empty when it applies).
   */
  private modifierStackDescribe(volume: THREE.Object3D, message: string, createdIds?: string[]): McpToolResult {
    const stack = ModifierVolume.read(volume);
    const status = modifierStackStatusRead(volume);
    const operationIssue = modifierStackOperationIssue(volume, stack, status);
    const data = { id: volume.uuid, name: volume.name, stack, status, operationIssue };
    return okResult(message, data, createdIds ? { createdIds } : undefined);
  }

  /**
   * Runs a tool body with the volume an id argument names.
   *
   * @param args Tool arguments with an id.
   * @param run Tool body.
   * @returns Tool result, or a failure when the id names no modifier volume.
   */
  private withVolume(args: Record<string, unknown>, run: (volume: THREE.Object3D) => McpToolResult): McpToolResult {
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    const volume = this.host.worldObject.getObjectByProperty('uuid', id);
    if (!volume || !ModifierVolume.isVolume(volume)) return failResult(`No modifier volume with id ${id}`);
    return run(volume);
  }

  /**
   * Resolves the parent a new volume goes under: the world, a plain group, a
   * solid model or a solid CSG group.
   *
   * @param parentId Parent id argument, or undefined for the world.
   * @returns Parent object, or a message when the id names nothing or an object
   *   that can not hold a volume.
   */
  private parentResolve(parentId: unknown): THREE.Object3D | string {
    if (parentId === undefined) return this.host.worldObject;
    const parent =
      typeof parentId === 'string' ? this.host.worldObject.getObjectByProperty('uuid', parentId) : undefined;
    if (!parent) return `No object with id ${String(parentId)}`;
    if (!editorApiModifierVolumeParentIs(parent)) {
      return `${parent.name || String(parentId)} can not hold a modifier volume; use the world, a group, a solid model or a CSG group`;
    }
    return parent;
  }

  /**
   * Positions a new volume so its world center lands on the requested point.
   *
   * @param volume New volume, not yet parented.
   * @param parent Parent that will receive it.
   * @param center World center argument.
   */
  private volumePlace(volume: THREE.Object3D, parent: THREE.Object3D, center: unknown): void {
    const world = editorApiModifierVector(center, 0);
    parent.updateWorldMatrix(true, false);
    volume.position.copy(parent.worldToLocal(world));
  }

  /** Refreshes outliner and views after the scene changed. */
  private worldRefresh(): void {
    this.host.refreshAfterWorldMutation();
    this.host.refreshOutliner();
  }
}

/**
 * Returns whether an object can hold a modifier volume: a plain group, a solid
 * model root or a solid CSG group.
 *
 * @param object Candidate parent below the world.
 * @returns True for those containers.
 */
function editorApiModifierVolumeParentIs(object: THREE.Object3D): boolean {
  if (SolidModel.isSolidModelObject(object) || isSolidCsgGroup(object)) return true;
  return object instanceof THREE.Group && object.type === 'Group' && !entityOwnerIs(object);
}

/**
 * Reads the box size of a new volume.
 *
 * @param size Size argument, or undefined for the default size.
 * @returns Edge lengths, or a message when a given edge length is not a
 *   positive number.
 */
function editorApiModifierVolumeSize(size: unknown): THREE.Vector3 | string {
  const extent = editorApiModifierVector(size, EDITOR_API_MODIFIER_VOLUME_DEFAULT_SIZE);
  const given = (size && typeof size === 'object' ? size : {}) as Record<string, unknown>;
  const invalid = (['x', 'y', 'z'] as const).find(
    (key) => given[key] !== undefined && !(Number.isFinite(given[key]) && Number(given[key]) > 0),
  );
  return invalid ? `size.${invalid} must be a positive number of meters` : extent;
}

/**
 * Reads an `{ x, y, z }` argument, filling missing components.
 *
 * @param value Vector argument.
 * @param fallback Value of a missing or invalid component.
 * @returns Vector.
 */
function editorApiModifierVector(value: unknown, fallback: number): THREE.Vector3 {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const component = (key: string): number => (Number.isFinite(input[key]) ? Number(input[key]) : fallback);
  return new THREE.Vector3(component('x'), component('y'), component('z'));
}

/**
 * Describes one inspector field as plain JSON.
 *
 * @param field Kind field.
 * @returns Field without functions.
 */
function editorApiModifierFieldDescribe(field: ModifierStackField): Record<string, unknown> {
  return JSON.parse(JSON.stringify(field)) as Record<string, unknown>;
}
