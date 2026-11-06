import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import {
  logicTestClassesInstall,
  logicTestRowCreate,
  logicTestSceneCreate,
  TEST_BUTTON_OUTPUT_PINS,
} from '../../game_entity/logic/game_entity_logic_test_support.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
  testDoorField,
} from '../../game_entity/game_entity_test_classes.js';
import {
  testDataAssetGameCreate,
  testDoorStatsAssetType,
} from '../../game_entity/data_asset/game_entity_data_asset_test_support.js';

/** An EditorApi over a fresh world. */
interface GameEntityToolsRig extends EditorApiTestHostParts {
  api: EditorApi;
}

/**
 * Builds an EditorApi over a fresh world.
 *
 * @returns The rig.
 */
function rigCreate(): GameEntityToolsRig {
  const parts = editorApiTestHostCreate();
  return { ...parts, api: new EditorApi(parts.host) };
}

/**
 * Returns the id a successful add tool reported.
 *
 * @param result Tool result.
 * @returns New object id.
 */
function createdIdRead(result: McpToolResult): string {
  const createdId = result.createdIds?.[0];
  if (!result.ok || createdId === undefined) {
    throw new Error(`add failed: ${result.message}`);
  }
  return createdId;
}

/**
 * Finds a world object by id and fails the test when it is missing.
 *
 * @param world World root.
 * @param id Object id.
 * @returns The object.
 */
function objectFind(world: THREE.Group, id: string): THREE.Object3D {
  const object = world.getObjectByProperty('uuid', id);
  if (!object) {
    throw new Error(`no object ${id}`);
  }
  return object;
}

/**
 * The game entity MCP tools list classes, place game entities, edit the game
 * components of any object through undoable commands and read and write data
 * assets through the running game.
 */
describe('EditorApiGameEntities', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityDataAssetClient.activeAdopt(null);
  });

  it('lists the known classes and asset types', () => {
    cleanups.push(testClassesInstall().uninstall);
    const result = rigCreate().api.invokeTool('list_game_classes');
    const data = result.data as { classes: { type_path: string }[]; assetTypes: { type_path: string }[] };
    expect(data.classes.map((gameClass) => gameClass.type_path)).toContain(TEST_DOOR_TYPE_PATH);
    expect(data.assetTypes.map((assetType) => assetType.type_path)).toContain(testDoorStatsAssetType().type_path);
  });

  it('adds a game entity with a class and overrides that undo removes', () => {
    cleanups.push(testClassesInstall().uninstall);
    const rig = rigCreate();
    const speed = Number(testDoorField('speed').default) + 1;
    const position = { x: 2, y: 0.5, z: -3 };
    const id = createdIdRead(
      rig.api.invokeTool('add_game_entity', { class: TEST_DOOR_TYPE_PATH, position, fields: { speed } }),
    );
    const owner = objectFind(rig.world, id);
    expect(GameEntityOwner.isOwner(owner)).toBe(true);
    expect(GameEntityComponentStore.read(owner)).toEqual({ [TEST_DOOR_TYPE_PATH]: { speed } });
    expect(owner.position.toArray()).toEqual([position.x, position.y, position.z]);
    expect(owner.scale.toArray()).toEqual([1, 1, 1]);
    rig.commandStack.undo();
    expect(rig.world.getObjectByProperty('uuid', id)).toBeUndefined();
  });

  it('keeps an added game entity at scale one when a scale is given', () => {
    cleanups.push(testClassesInstall().uninstall);
    const rig = rigCreate();
    const id = createdIdRead(
      rig.api.invokeTool('add_game_entity', {
        class: TEST_DOOR_TYPE_PATH,
        scale: { x: 4, y: 4, z: 4 },
      }),
    );
    expect(objectFind(rig.world, id).scale.toArray()).toEqual([1, 1, 1]);
  });

  it('refuses unknown classes and values that do not fit', () => {
    cleanups.push(testClassesInstall().uninstall);
    const rig = rigCreate();
    expect(rig.api.invokeTool('add_game_entity', { class: 'other_game::Lever' }).ok).toBe(false);
    expect(rig.api.invokeTool('add_game_entity', { class: TEST_DOOR_TYPE_PATH, fields: { speed: 'fast' } }).ok).toBe(
      false,
    );
    expect(rig.world.children).toHaveLength(0);
  });

  it('sets and removes components of any object as undoable edits', () => {
    cleanups.push(testClassesInstall().uninstall);
    const rig = rigCreate();
    const mesh = new THREE.Mesh();
    rig.world.add(mesh);
    GameEntityComponentStore.write(mesh, { [TEST_DOOR_TYPE_PATH]: {} });
    const axis = [1, 0, 0];
    const result = rig.api.invokeTool('set_game_components', {
      id: mesh.uuid,
      components: { [TEST_SPINNER_TYPE_PATH]: { axis }, [TEST_DOOR_TYPE_PATH]: null },
    });
    expect(result.ok).toBe(true);
    expect(GameEntityComponentStore.read(mesh)).toEqual({ [TEST_SPINNER_TYPE_PATH]: { axis } });
    rig.commandStack.undo();
    expect(GameEntityComponentStore.read(mesh)).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
  });

  it('fails for unknown objects and unknown fields without changing anything', () => {
    cleanups.push(testClassesInstall().uninstall);
    const rig = rigCreate();
    const mesh = new THREE.Mesh();
    rig.world.add(mesh);
    expect(rig.api.invokeTool('set_game_components', { id: 'missing', components: {} }).ok).toBe(false);
    const result = rig.api.invokeTool('set_game_components', {
      id: mesh.uuid,
      components: { [TEST_SPINNER_TYPE_PATH]: { wobble: 1 } },
    });
    expect(result.ok).toBe(false);
    expect(GameEntityComponentStore.hasAny(mesh)).toBe(false);
    expect(rig.commandStack.undo()).toBe(false);
  });

  it('sets the full output list of an object as one undoable edit and reports target status', () => {
    cleanups.push(logicTestClassesInstall());
    const rig = rigCreate();
    const { button, doors } = logicTestSceneCreate(2);
    rig.world.add(button, ...doors);
    const singleName = doors[0]?.name ?? '';
    const outputs = [
      { output: 'OnPressed', target: singleName, input: 'Open', delay: 0.5 },
      { output: 'OnPressed', target: 'door_*', input: 'Close', times_to_fire: 1 },
      { output: 'OnReleased', target: 'missing_object', input: 'Open' },
    ];
    const result = rig.api.invokeTool('set_logic_outputs', { id: button.uuid, outputs });
    expect(result.ok).toBe(true);
    expect(GameEntityLogicStore.read(button)).toEqual(outputs.map((row) => logicTestRowCreate(row)));
    const report = result.data as { outputs: { status: string; targetIds: string[] }[] };
    expect(report.outputs.map((row) => row.status)).toEqual(['valid_single', 'valid_multiple', 'broken']);
    expect(new Set(report.outputs[1]?.targetIds)).toEqual(new Set(doors.map((door) => door.uuid)));
    rig.commandStack.undo();
    expect(GameEntityLogicStore.read(button)).toEqual([]);
  });

  it('refuses malformed output rows and unknown objects without changing anything', () => {
    const rig = rigCreate();
    const { button } = logicTestSceneCreate(0);
    rig.world.add(button);
    expect(rig.api.invokeTool('set_logic_outputs', { id: 'missing', outputs: [] }).ok).toBe(false);
    expect(rig.api.invokeTool('set_logic_outputs', { id: button.uuid, outputs: 'OnPressed' }).ok).toBe(false);
    const missingInput = rig.api.invokeTool('set_logic_outputs', {
      id: button.uuid,
      outputs: [{ output: 'OnPressed', target: '!self' }],
    });
    expect(missingInput.ok).toBe(false);
    expect(rig.commandStack.canUndo()).toBe(false);
  });

  it('reads the outputs, declared outputs and incoming connections of an object', () => {
    cleanups.push(logicTestClassesInstall());
    const rig = rigCreate();
    const { button, doors } = logicTestSceneCreate(1);
    const door = doors[0] ?? button;
    rig.world.add(button, door);
    GameEntityLogicStore.write(button, [logicTestRowCreate({ target: door.name, input: 'Open' })]);
    const doorReport = rig.api.invokeTool('read_logic_outputs', { id: door.uuid }).data as {
      outputs: unknown[];
      incoming: { sourceId: string; input: string }[];
    };
    expect(doorReport.outputs).toEqual([]);
    expect(doorReport.incoming).toEqual([expect.objectContaining({ sourceId: button.uuid, input: 'Open' })]);
    const buttonReport = rig.api.invokeTool('read_logic_outputs', { id: button.uuid }).data as {
      declaredOutputs: { name: string }[];
    };
    expect(buttonReport.declaredOutputs.map((pin) => pin.name)).toEqual(TEST_BUTTON_OUTPUT_PINS.map((pin) => pin.name));
  });

  it('reads and writes data assets through the running game', async () => {
    cleanups.push(testClassesInstall().uninstall);
    const { transport, client } = testDataAssetGameCreate();
    GameEntityDataAssetClient.activeAdopt(client);
    const rig = rigCreate();
    const assetType = testDoorStatsAssetType();
    const path = assetType.paths[0] ?? '';
    const read = await rig.api.invokeToolAsync('read_data_asset', { path });
    expect((read.data as { values: unknown }).values).toEqual(transport.dataAssetFiles.get(path)?.values);
    const values = { [assetType.fields?.[1]?.path ?? 'value']: 9 };
    const written = await rig.api.invokeToolAsync('write_data_asset', { path: 'data/made.door.ron', values });
    expect(written.ok).toBe(true);
    expect(transport.dataAssetFiles.get('data/made.door.ron')).toEqual({ type_path: assetType.type_path, values });
  });

  it('reports that data assets need the game preview', async () => {
    const result = await rigCreate().api.invokeToolAsync('read_data_asset', { path: 'data/a.door.ron' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('preview');
  });
});
