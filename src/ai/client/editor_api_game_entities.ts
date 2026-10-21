import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityAssetType } from '@/game_entity/class/game_entity_class_schema.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import {
  type GameEntityComponentsPatch,
  gameEntityComponentsPatchApply,
} from '@/game_entity/component/game_entity_components_patch.js';
import { gameEntityDataAssetPathMatches } from '@/game_entity/data_asset/game_entity_data_asset_class.js';
import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { editorApiTransformApply, type EditorApiTransformArgs } from './editor_api_transform.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';

/** Arguments of the add_game_entity tool. */
export interface GameEntityAddArgs extends EditorApiTransformArgs {
  class?: string;
  name?: string;
  fields?: Record<string, unknown>;
}

/** Arguments of the set_game_components tool. */
export interface GameComponentsSetArgs {
  id: string;
  components: GameEntityComponentsPatch;
}

/** Arguments of the read_data_asset tool. */
export interface DataAssetReadArgs {
  path: string;
}

/** Arguments of the write_data_asset tool. */
export interface DataAssetWriteArgs {
  path: string;
  typePath?: string;
  values: Record<string, unknown>;
}

/**
 * Lists the game's component classes, places game entities, edits the game
 * components of any object through undoable commands, and reads and writes data
 * asset files through the running game.
 */
export class EditorApiGameEntities {
  private readonly host: EditorApiHost;

  /**
   * Creates the game entity tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Lists every known component class with its fields and defaults, and the
   * asset types asset fields may reference.
   *
   * @returns Result with classes and asset types.
   */
  gameClassesList(): McpToolResult {
    const classes = GameEntityClassRegistry.classesList();
    const assetTypes = GameEntityClassRegistry.assetTypesList();
    return okResult(`${classes.length} game component classes`, { classes, assetTypes });
  }

  /**
   * Adds a game entity, optionally carrying one class with field overrides.
   *
   * @param args Class type path, name, transform and field values.
   * @returns Result naming the new entity's id and its components.
   */
  gameEntityAdd(args: GameEntityAddArgs): McpToolResult {
    const patch: GameEntityComponentsPatch = args.class ? { [args.class]: args.fields ?? {} } : {};
    const patched = gameEntityComponentsPatchApply({}, patch);
    if (patched.errors.length > 0) {
      return failResult(patched.errors.join('; '));
    }
    const label = args.class ? GameEntityClassRegistry.classFind(args.class)?.label : undefined;
    const owner = GameEntityOwner.createDefault(args.name ?? label ?? 'Game Entity');
    GameEntityComponentStore.write(owner, patched.components);
    editorApiTransformApply(owner, args);
    this.host.commandStack.push(new CommandPrimitiveCreate(owner, this.host.worldObject));
    this.host.refreshAfterWorldMutation();
    const data = { id: owner.uuid, components: patched.components };
    return okResult(`Added game entity ${owner.name}`, data, { createdIds: [owner.uuid] });
  }

  /**
   * Sets, adds and removes game components of any object as one undoable edit.
   *
   * @param args Object id and component changes; null removes a component.
   * @returns Result with the object's components after the edit.
   */
  gameComponentsSet(args: GameComponentsSetArgs): McpToolResult {
    const object = this.objectFind(args.id);
    if (!object) {
      return failResult(`No object with id ${args.id}`);
    }
    const patched = gameEntityComponentsPatchApply(GameEntityComponentStore.read(object), args.components ?? {});
    if (patched.errors.length > 0) {
      return failResult(patched.errors.join('; '));
    }
    const command = new CommandGameEntityComponentsSet([object], () => patched.components);
    if (command.hasChanges()) {
      this.host.commandStack.push(command);
      this.host.refreshAfterWorldMutation();
    }
    return okResult(`Updated game components of ${object.name}`, { id: object.uuid, components: patched.components });
  }

  /**
   * Reads a data asset file through the running game.
   *
   * @param args Asset path of the file.
   * @returns Result with the type path, the overrides and the type's fields.
   */
  async dataAssetRead(args: DataAssetReadArgs): Promise<McpToolResult> {
    const client = GameEntityDataAssetClient.activeRead();
    if (!client) {
      return failResult('Connect the game preview to read data assets');
    }
    const reply = await client.read(args.path);
    const fields = GameEntityClassRegistry.assetTypeFind(reply.type_path)?.fields ?? [];
    return okResult(`Read ${reply.path}`, {
      path: reply.path,
      typePath: reply.type_path,
      values: reply.values,
      fields,
    });
  }

  /**
   * Writes a data asset file through the running game, creating it when
   * missing. The type is taken from the path's extension when not given.
   *
   * @param args Asset path, optional type path and the overrides to store.
   * @returns Result with the status generation that marks the write as done.
   */
  async dataAssetWrite(args: DataAssetWriteArgs): Promise<McpToolResult> {
    const client = GameEntityDataAssetClient.activeRead();
    const typePath = args.typePath ?? this.dataAssetTypeOfPath(args.path)?.type_path;
    if (!client || !typePath) {
      return failResult(
        client ? `No data asset type uses ${args.path}` : 'Connect the game preview to write data assets',
      );
    }
    const values = GameEntityComponentStore.fieldsFromUnknown(args.values);
    const generation = await client.write(args.path, typePath, values);
    return okResult(`Wrote ${args.path}`, { path: args.path, typePath, values, generation });
  }

  /**
   * Returns the editable asset type whose extension a path has.
   *
   * @param path Asset path.
   * @returns Asset type, or null.
   */
  private dataAssetTypeOfPath(path: string): GameEntityAssetType | null {
    const assetTypes = GameEntityClassRegistry.assetTypesList();
    return (
      assetTypes.find((assetType) => assetType.editable && gameEntityDataAssetPathMatches(assetType, path)) ?? null
    );
  }

  /**
   * Finds an object of the world by id.
   *
   * @param id Object uuid.
   * @returns Object, or null.
   */
  private objectFind(id: string): THREE.Object3D | null {
    return this.host.worldObject.getObjectByProperty('uuid', id) ?? null;
  }
}
