import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { LAYER_FLAG_NAMES, type LayerDefinition, type LayerFlagName } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';
import { LayerOperations } from '@/layer/operations/layer_operations.js';

/** One layer as list_layers reports it. */
export interface EditorApiLayerSummary extends LayerDefinition {
  current: boolean;
  objectIds: string[];
}

/**
 * Lists and edits layers through the same undoable operations the layers panel
 * uses.
 */
export class EditorApiLayers {
  private readonly host: EditorApiHost;

  /**
   * Creates the layer tools.
   *
   * @param host Live editor systems.
   */
  constructor(host: EditorApiHost) {
    this.host = host;
  }

  /**
   * Runs a layer tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no layer tool.
   */
  layerToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'list_layers':
        return this.withOperations((operations) => this.layersList(operations.layerManager));
      case 'create_layer':
        return this.withOperations((operations) => this.layerCreate(operations, args));
      case 'remove_layer':
        return this.withOperations((operations) => this.layerRemove(operations, args));
      case 'rename_layer':
        return this.withOperations((operations) => this.layerRename(operations, args));
      case 'set_current_layer':
        return this.withOperations((operations) => this.currentLayerSet(operations, args));
      case 'set_layer_flags':
        return this.withOperations((operations) => this.layerFlagsSet(operations, args));
      case 'move_objects_to_layer':
        return this.withOperations((operations) => this.objectsMoveToLayer(operations, args));
      default:
        return null;
    }
  }

  /**
   * Runs a tool with the layer operations of the host world.
   *
   * @param run Tool body.
   * @returns Tool result, or a failure when the world has no layers.
   */
  private withOperations(run: (operations: LayerOperations) => McpToolResult): McpToolResult {
    const manager = LayerManagerLookup.find(this.host.worldObject);
    if (manager === null) {
      return failResult('Layers are not available in this editor');
    }
    return run(new LayerOperations(manager, this.host.commandStack, this.host.refreshAfterWorldMutation));
  }

  /**
   * Lists every layer with its switches, current state and top-level objects.
   *
   * @param manager Layer manager.
   * @returns Result with the layers and the current layer id.
   */
  private layersList(manager: LayerManager): McpToolResult {
    const currentLayerId = manager.currentLayerIdRead();
    const layers: EditorApiLayerSummary[] = manager.layersList().map((definition) => ({
      ...definition,
      current: definition.id === currentLayerId,
      objectIds: manager.objectsInLayerCollect(definition.id).map((object) => object.uuid),
    }));
    return okResult(`${layers.length} layers`, { layers, currentLayerId });
  }

  /**
   * Adds a layer.
   *
   * @param operations Layer operations.
   * @param args Optional name.
   * @returns Result with the new layer.
   */
  private layerCreate(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const name = typeof args['name'] === 'string' ? args['name'] : undefined;
    const definition = operations.layerCreate(name);
    return okResult(`Created layer ${definition.name}`, definition, { createdIds: [definition.id] });
  }

  /**
   * Removes a layer.
   *
   * @param operations Layer operations.
   * @param args Layer id.
   * @returns Result naming the removed layer.
   */
  private layerRemove(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const definition = this.layerFromArgs(operations.layerManager, args['id']);
    if (definition === null) {
      return failResult(`No layer with id ${String(args['id'])}`);
    }
    if (!operations.layerRemove(definition.id)) {
      return failResult('The default layer cannot be removed');
    }
    return okResult(`Removed layer ${definition.name}`, { id: definition.id });
  }

  /**
   * Renames a layer.
   *
   * @param operations Layer operations.
   * @param args Layer id and new name.
   * @returns Result with the renamed layer.
   */
  private layerRename(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const definition = this.layerFromArgs(operations.layerManager, args['id']);
    const name = typeof args['name'] === 'string' ? args['name'].trim() : '';
    if (definition === null || name.length === 0) {
      return failResult('rename_layer needs an existing layer id and a non-blank name');
    }
    if (definition.name !== name && !operations.layerRename(definition.id, name)) {
      return failResult('The default layer cannot be renamed');
    }
    return okResult(`Renamed layer to ${name}`, { ...definition });
  }

  /**
   * Makes a layer current.
   *
   * @param operations Layer operations.
   * @param args Layer id.
   * @returns Result naming the current layer.
   */
  private currentLayerSet(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const definition = this.layerFromArgs(operations.layerManager, args['id']);
    if (definition === null || !operations.currentLayerSet(definition.id)) {
      return failResult(`No layer with id ${String(args['id'])}`);
    }
    return okResult(`Current layer is ${definition.name}`, { id: definition.id });
  }

  /**
   * Sets switches of a layer.
   *
   * @param operations Layer operations.
   * @param args Layer id and switch values.
   * @returns Result with the layer after the edit.
   */
  private layerFlagsSet(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const definition = this.layerFromArgs(operations.layerManager, args['id']);
    if (definition === null) {
      return failResult(`No layer with id ${String(args['id'])}`);
    }
    operations.layerFlagsSet(definition.id, EditorApiLayers.flagsFromArgs(args));
    return okResult(`Updated layer ${definition.name}`, { ...definition });
  }

  /**
   * Moves objects into a layer.
   *
   * @param operations Layer operations.
   * @param args Object ids and target layer id.
   * @returns Result with the ids of the moved top-level objects.
   */
  private objectsMoveToLayer(operations: LayerOperations, args: Record<string, unknown>): McpToolResult {
    const definition = this.layerFromArgs(operations.layerManager, args['layerId']);
    if (definition === null) {
      return failResult(`No layer with id ${String(args['layerId'])}`);
    }
    const objects = this.objectsFromIds(args['ids']);
    if (objects.missingIds.length > 0) {
      return failResult(`No objects with ids ${objects.missingIds.join(', ')}`);
    }
    const moved = operations.objectsMoveToLayer(objects.found, definition.id);
    const movedIds = moved.map((object) => object.uuid);
    return okResult(`Moved ${movedIds.length} objects to ${definition.name}`, { layerId: definition.id, movedIds });
  }

  /**
   * Finds the layer an argument names.
   *
   * @param manager Layer manager.
   * @param identifier Raw id argument.
   * @returns The layer, or null.
   */
  private layerFromArgs(manager: LayerManager, identifier: unknown): LayerDefinition | null {
    return typeof identifier === 'string' ? manager.layerFind(identifier) : null;
  }

  /**
   * Resolves object ids in the host world.
   *
   * @param identifiers Raw ids argument.
   * @returns Found objects and the ids that matched nothing.
   */
  private objectsFromIds(identifiers: unknown): { found: THREE.Object3D[]; missingIds: string[] } {
    const ids = Array.isArray(identifiers) ? identifiers.filter((id): id is string => typeof id === 'string') : [];
    const found: THREE.Object3D[] = [];
    const missingIds: string[] = [];
    ids.forEach((id) => {
      const object = this.host.worldObject.getObjectByProperty('uuid', id);
      if (object) found.push(object);
      else missingIds.push(id);
    });
    return { found, missingIds };
  }

  /**
   * Reads the switch values given as booleans.
   *
   * @param args Tool arguments.
   * @returns Switches to set.
   */
  private static flagsFromArgs(args: Record<string, unknown>): Partial<Record<LayerFlagName, boolean>> {
    const flags: Partial<Record<LayerFlagName, boolean>> = {};
    LAYER_FLAG_NAMES.forEach((flag) => {
      const value = args[flag];
      if (typeof value === 'boolean') flags[flag] = value;
    });
    return flags;
  }
}
