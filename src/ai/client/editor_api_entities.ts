import * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityOwnerRegistryFindByKind } from '@/entity/registry/entity_owner_registry.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';

/** Arguments of the add_light, add_room and add_portal tools. */
export interface EntityAddArgs {
  name?: string;
  position?: { x: number; y: number; z: number };
  rotationDegrees?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  settings?: Record<string, unknown>;
}

/**
 * Arguments of the set_light_settings, set_room_settings and
 * set_portal_settings tools.
 */
export interface EntitySettingsSetArgs {
  id: string;
  settings: Record<string, unknown>;
}

/**
 * Adds lights, rooms and portals and edits their settings through undoable
 * commands.
 */
export class EditorApiEntities {
  private readonly host: EditorApiHost;

  /**
   * Creates the entity tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Adds an entity of one kind at the requested transform with the requested
   * settings merged over the defaults.
   *
   * @param kind Entity kind to add.
   * @param args Name, transform and partial settings.
   * @returns Result naming the new entity's id and its settings.
   */
  entityAdd(kind: EntityKind, args: EntityAddArgs): McpToolResult {
    const entityOwner = this.entityOwnerOfKind(kind);
    const settings = this.settingsMerge(entityOwner, entityOwner.definition.settingsCreateDefault(), args.settings);
    if (!settings) {
      return failResult(`Invalid ${kind} settings`);
    }
    const owner = entityOwner.create(args.name ?? this.entityDefaultName(kind), settings);
    this.entityTransformApply(owner, args);
    this.host.commandStack.push(new CommandPrimitiveCreate(owner, this.host.worldObject));
    this.host.refreshAfterWorldMutation();
    return okResult(`Added ${kind} ${owner.name}`, { id: owner.uuid, settings }, { createdIds: [owner.uuid] });
  }

  /**
   * Merges partial settings into an entity's current settings as one undoable
   * edit.
   *
   * @param kind Entity kind the id must have.
   * @param args Entity id and partial settings.
   * @returns Result with the settings after the edit.
   */
  entitySettingsSet(kind: EntityKind, args: EntitySettingsSetArgs): McpToolResult {
    const entityOwner = this.entityOwnerOfKind(kind);
    const owner = this.host.worldObject.getObjectByProperty('uuid', args.id);
    const current = owner ? entityOwner.settingsRead(owner) : null;
    if (!owner || !current) {
      return failResult(`No ${kind} with id ${args.id}`);
    }
    const next = this.settingsMerge(entityOwner, current, args.settings);
    if (!next) {
      return failResult(`Invalid ${kind} settings`);
    }
    this.host.commandStack.push(new CommandEntitySettingsSet(entityOwner, [owner], () => next));
    this.host.refreshAfterWorldMutation();
    return okResult(`Updated ${kind} ${owner.name}`, { id: owner.uuid, settings: next });
  }

  /**
   * Returns the owner helper of a kind every editor build registers.
   *
   * @param kind Entity kind.
   * @returns Owner helper.
   */
  private entityOwnerOfKind(kind: EntityKind): EntityOwner<object> {
    const entityOwner = entityOwnerRegistryFindByKind(kind);
    if (!entityOwner) {
      throw new Error(`Entity kind ${kind} is not registered`);
    }
    return entityOwner;
  }

  /**
   * Merges partial settings over base settings and sanitizes the result.
   *
   * @param entityOwner Owner helper of the kind.
   * @param base Settings to start from.
   * @param partial Settings to change, or undefined to keep the base.
   * @returns Sanitized settings, or null when the merge is not valid settings.
   */
  private settingsMerge(
    entityOwner: EntityOwner<object>,
    base: object,
    partial: Record<string, unknown> | undefined,
  ): object | null {
    return entityOwner.definition.settingsFromUnknown({ ...base, ...(partial ?? {}) });
  }

  /**
   * Places a new entity owner at the requested position, rotation and scale.
   *
   * @param owner New entity owner.
   * @param args Transform arguments; missing parts keep the defaults.
   */
  private entityTransformApply(owner: THREE.Object3D, args: EntityAddArgs): void {
    if (args.position) {
      owner.position.set(args.position.x, args.position.y, args.position.z);
    }
    if (args.rotationDegrees) {
      const radians = THREE.MathUtils.degToRad;
      owner.rotation.set(
        radians(args.rotationDegrees.x),
        radians(args.rotationDegrees.y),
        radians(args.rotationDegrees.z),
      );
    }
    if (args.scale) {
      owner.scale.set(args.scale.x, args.scale.y, args.scale.z);
    }
    owner.updateMatrixWorld(true);
  }

  /**
   * Returns the name a new entity gets when none is given.
   *
   * @param kind Entity kind.
   * @returns Display name.
   */
  private entityDefaultName(kind: EntityKind): string {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}
