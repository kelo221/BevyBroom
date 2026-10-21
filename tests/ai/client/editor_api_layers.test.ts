import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { EditorApiLayerSummary } from '@/ai/client/editor_api_layers.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';

/** Names of every layer tool. */
const LAYER_TOOL_NAMES = [
  'list_layers',
  'create_layer',
  'remove_layer',
  'rename_layer',
  'set_current_layer',
  'set_layer_flags',
  'move_objects_to_layer',
];

/** Editor API over a world with layers, and its host parts. */
interface LayerApiRig {
  parts: EditorApiTestHostParts;
  api: EditorApi;
  manager: LayerManager;
}

/**
 * Builds an editor API over a fresh world with a layer manager.
 *
 * @returns Test rig.
 */
function layerApiRigCreate(): LayerApiRig {
  const parts = editorApiTestHostCreate();
  const manager = new LayerManager(parts.world);
  return { parts, api: new EditorApi(parts.host), manager };
}

/**
 * Returns the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns The result data.
 */
function toolData<Data>(result: McpToolResult): Data {
  if (!result.ok) {
    throw new Error(`tool failed: ${result.message}`);
  }
  return result.data as Data;
}

/**
 * Creates a layer through the tools and returns its id.
 *
 * @param api Editor API.
 * @param name Layer name.
 * @returns Layer id.
 */
function layerCreateThroughApi(api: EditorApi, name: string): string {
  return toolData<{ id: string }>(api.invokeTool('create_layer', { name })).id;
}

/**
 * Unit tests for the layer tools: every tool is listed, edits are undoable and
 * use the same rules as the layers panel.
 */
describe('EditorApi layer tools', () => {
  it('lists every layer tool', () => {
    LAYER_TOOL_NAMES.forEach((name) => expect(findMcpTool(name)).toBeDefined());
  });

  it('creates, renames, flags and lists layers, each edit undoable', () => {
    const rig = layerApiRigCreate();
    const id = layerCreateThroughApi(rig.api, 'Props');
    toolData(rig.api.invokeTool('rename_layer', { id, name: 'Furniture' }));
    toolData(rig.api.invokeTool('set_layer_flags', { id, hidden: true, omitFromExport: true }));
    const listed = toolData<{ layers: EditorApiLayerSummary[] }>(rig.api.invokeTool('list_layers')).layers;
    const layer = listed.find((entry) => entry.id === id);
    expect(listed[0]?.id).toBe(LAYER_DEFAULT_ID);
    expect(layer).toMatchObject({ name: 'Furniture', hidden: true, omitFromExport: true, locked: false });
    rig.parts.commandStack.undo();
    expect(rig.manager.layerFind(id)?.hidden).toBe(false);
    rig.parts.commandStack.undo();
    expect(rig.manager.layerFind(id)?.name).toBe('Props');
  });

  it('moves objects into a layer and makes a layer current without an undo step', () => {
    const rig = layerApiRigCreate();
    const id = layerCreateThroughApi(rig.api, 'Target');
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    rig.parts.world.add(box);
    const moved = toolData<{ movedIds: string[] }>(
      rig.api.invokeTool('move_objects_to_layer', { ids: [box.uuid], layerId: id }),
    );
    expect(moved.movedIds).toEqual([box.uuid]);
    expect(layerIdStoredRead(box)).toBe(id);
    const undoCount = rig.parts.commandStack.getUndoCount();
    toolData(rig.api.invokeTool('set_current_layer', { id }));
    expect(rig.manager.currentLayerIdRead()).toBe(id);
    expect(rig.parts.commandStack.getUndoCount()).toBe(undoCount);
  });

  it('refuses to remove or rename the default layer and reports unknown ids', () => {
    const rig = layerApiRigCreate();
    expect(rig.api.invokeTool('remove_layer', { id: LAYER_DEFAULT_ID }).ok).toBe(false);
    expect(rig.api.invokeTool('rename_layer', { id: LAYER_DEFAULT_ID, name: 'Other' }).ok).toBe(false);
    expect(rig.api.invokeTool('set_layer_flags', { id: 'missing_layer', hidden: true }).ok).toBe(false);
    expect(rig.api.invokeTool('move_objects_to_layer', { ids: ['missing'], layerId: LAYER_DEFAULT_ID }).ok).toBe(false);
  });

  it('removes a layer and puts its objects into the default layer', () => {
    const rig = layerApiRigCreate();
    const id = layerCreateThroughApi(rig.api, 'Removed');
    toolData(rig.api.invokeTool('set_current_layer', { id }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    rig.parts.world.add(box);
    toolData(rig.api.invokeTool('remove_layer', { id }));
    expect(rig.manager.layerFind(id)).toBeNull();
    expect(layerIdStoredRead(box)).toBe(LAYER_DEFAULT_ID);
  });

  it('fails when the editor world has no layers', () => {
    const parts = editorApiTestHostCreate();
    expect(new EditorApi(parts.host).invokeTool('list_layers').ok).toBe(false);
  });
});
