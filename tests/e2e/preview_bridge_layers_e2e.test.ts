import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { type PreviewLinkTransport, PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import {
  PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
  PREVIEW_E2E_DOOR_COMPONENT,
  PREVIEW_E2E_GAME_ENTITY_COMPONENT,
  previewE2eObjectComponentRead,
} from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of layers: a game entity put into a layer through the
 * editor's MCP tools disappears from the game while its layer is hidden or
 * omitted from export and comes back when the switch is cleared, and a level
 * exported with the layer omitted ships without it. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen six
 * and seven ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(6);
const shippedEnvironment = previewE2eEnvironmentRead(7);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const PAD_SIZE = new THREE.Vector3(2, 0.5, 2);
const SHIPPED_SCENE_PATH = 'shipped/layers_level.glb';
const MANIFEST_FILE_NAME = 'level.broom.json';

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
 * Finds the level manifest the game wrote for a level under a project.
 *
 * @param directory Directory to search.
 * @param levelName Level name the manifest belongs to.
 * @returns Manifest path, or null when the game has not written it.
 */
function manifestPathFind(directory: string, levelName: string): string | null {
  const entries = readdirSync(directory, { recursive: true, encoding: 'utf8' });
  const match = entries.find(
    (entry) => basename(entry) === MANIFEST_FILE_NAME && basename(dirname(join(directory, entry))) === levelName,
  );
  return match === undefined ? null : join(directory, match);
}

/**
 * Returns whether a game shows the door of an editor object on the given
 * marker.
 *
 * @param transport Transport to the game.
 * @param marker Marker type path: the game entity or exported node marker.
 * @param objectId Editor object id.
 * @returns True when the game has that door.
 */
async function gameDoorShownIs(transport: PreviewLinkTransport, marker: string, objectId: string): Promise<boolean> {
  return (await previewE2eObjectComponentRead(transport, marker, objectId, PREVIEW_E2E_DOOR_COMPONENT)) !== null;
}

describe.skipIf(!environment.isConfigured)('layers in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let layerManager: LayerManager;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let layerId = '';
  let layeredEntityId = '';
  let keptEntityId = '';

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    parts = editorApiTestHostCreate();
    layerManager = new LayerManager(parts.world);
    api = new EditorApi(parts.host);
    const pad = previewE2eGameMaterialBoxCreate(
      'Pad',
      'stone/castle_wall',
      new THREE.Vector3(0, PAD_SIZE.y / 2, 0),
      PAD_SIZE,
    );
    parts.world.add(pad);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'layers_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    layerManager?.dispose();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Keeps the editor link updating until a check on the game passes.
   *
   * @param description What is waited for.
   * @param check Reads the game and returns true when satisfied.
   */
  async function gameUntil(description: string, check: () => Promise<boolean>): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      if (await check().catch(() => false)) {
        return;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Waits until the live game shows or lacks the layered door, and always shows
   * the door of the default layer.
   *
   * @param description What is waited for.
   * @param isLayeredShown Whether the layered door must be shown.
   */
  function layeredDoorUntil(description: string, isLayeredShown: boolean): Promise<void> {
    return gameUntil(description, async () => {
      const marker = PREVIEW_E2E_GAME_ENTITY_COMPONENT;
      const isLayeredInGame = await gameDoorShownIs(rig.transport, marker, layeredEntityId);
      const isKeptInGame = await gameDoorShownIs(rig.transport, marker, keptEntityId);
      return isKeptInGame && isLayeredInGame === isLayeredShown;
    });
  }

  /**
   * Sets switches of the test layer through the MCP tools.
   *
   * @param flags Switch values.
   */
  function layerFlagsSet(flags: Record<string, boolean>): void {
    toolData(api.invokeTool('set_layer_flags', { id: layerId, ...flags }));
  }

  it(
    'shows a game entity placed into a new layer',
    async () => {
      await rig.until(
        'the game classes',
        (view) => rig.isCaughtUp(view) && GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT) !== null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      layerId = toolData<{ id: string }>(api.invokeTool('create_layer', { name: 'Doors' })).id;
      toolData(api.invokeTool('set_current_layer', { id: layerId }));
      const doorArgs = { class: PREVIEW_E2E_DOOR_COMPONENT };
      layeredEntityId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', { ...doorArgs, position: { x: 3, y: 0, z: 0 } }),
      ).id;
      toolData(api.invokeTool('set_current_layer', { id: LAYER_DEFAULT_ID }));
      keptEntityId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', { ...doorArgs, position: { x: -3, y: 0, z: 0 } }),
      ).id;
      const layers = toolData<{ layers: { id: string; objectIds: string[] }[] }>(api.invokeTool('list_layers')).layers;
      expect(layers.find((layer) => layer.id === layerId)?.objectIds).toEqual([layeredEntityId]);
      await layeredDoorUntil('both doors in the game', true);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'hides the entity in the game while its layer is hidden, keeping its saved visibility',
    async () => {
      layerFlagsSet({ hidden: true });
      await layeredDoorUntil('the hidden layer door to leave the game', false);
      expect(parts.world.getObjectByProperty('uuid', layeredEntityId)?.visible).toBe(true);
      layerFlagsSet({ hidden: false });
      await layeredDoorUntil('the shown layer door to come back', true);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'removes the entity from the game while its layer is omitted from export',
    async () => {
      layerFlagsSet({ omitFromExport: true });
      await layeredDoorUntil('the omitted layer door to leave the game', false);
      expect(parts.commandStack.undo()).toBe(true);
      await layeredDoorUntil('the door to come back after undo', true);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  /**
   * Waits until the live game wrote a manifest with the kept door and without
   * the layered door.
   */
  function manifestWithoutLayeredDoorUntil(): Promise<void> {
    return gameUntil('the manifest without the omitted door', async () => {
      const manifestPath = manifestPathFind(projectDirectory, rig.levelName);
      const manifest = manifestPath === null ? '' : readFileSync(manifestPath, 'utf8');
      return manifest.includes(keptEntityId) && !manifest.includes(layeredEntityId);
    });
  }

  /**
   * Waits until the shipped game loaded two doors, the kept door from the
   * manifest and from the exported GLB, and checks the omitted door is on
   * neither.
   *
   * @param transport Transport to the shipped game.
   */
  async function shippedDoorsCheck(transport: PreviewLinkTransportHttp): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      const doorRows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DOOR_COMPONENT]).catch(() => []);
      if (doorRows.length >= 2) {
        expect(doorRows.length).toBe(2);
        expect(await gameDoorShownIs(transport, PREVIEW_E2E_GAME_ENTITY_COMPONENT, keptEntityId)).toBe(true);
        expect(await gameDoorShownIs(transport, PREVIEW_E2E_GAME_ENTITY_COMPONENT, layeredEntityId)).toBe(false);
        expect(await gameDoorShownIs(transport, PREVIEW_E2E_AUTHORED_NODE_COMPONENT, layeredEntityId)).toBe(false);
        return;
      }
      await previewE2eSleep(250);
    }
    throw new Error('Timed out waiting for the shipped doors');
  }

  it(
    'ships a level exported with the layer omitted without its entity',
    async () => {
      layerFlagsSet({ omitFromExport: true });
      await layeredDoorUntil('the omitted layer door to leave the game', false);
      await manifestWithoutLayeredDoorUntil();
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(parts.world)));
      const shippedProject = previewE2eProjectCopy(projectDirectory);
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH, '--level', rig.levelName],
      );
      shippedGame.start();
      try {
        await shippedDoorsCheck(new PreviewLinkTransportHttp(shippedEnvironment.endpoint));
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );
});
