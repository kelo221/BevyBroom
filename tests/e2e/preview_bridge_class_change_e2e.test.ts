import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import { PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT, previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import {
  PREVIEW_E2E_DOOR_COMPONENT,
  PREVIEW_E2E_GAME_ENTITY_COMPONENT,
  previewE2eObjectComponentRead,
} from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of class change: a point light converted to a Door
 * keeps its uuid, the game despawns the light and spawns the game entity, a
 * shipped GLB carries the Door, and undo restores the light. Light presence is
 * read from DynamicLight, because AuthoredLightEntity is not reflected for the
 * remote protocol. Skipped unless BROOM_E2E_PREVIEW_EXE and
 * BROOM_E2E_PROJECT_DIR are set; its games listen eighteen and nineteen ports
 * above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(18);
const shippedEnvironment = previewE2eEnvironmentRead(19);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const PAD_SIZE = new THREE.Vector3(2, 0.5, 2);
const SHIPPED_SCENE_PATH = 'shipped/class_change_level.glb';

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

describe.skipIf(!environment.isConfigured)('class change in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let objectId = '';

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
    api = new EditorApi(parts.host);
    const pad = previewE2eGameMaterialBoxCreate(
      'Pad',
      'stone/castle_wall',
      new THREE.Vector3(0, PAD_SIZE.y / 2, 0),
      PAD_SIZE,
    );
    parts.world.add(pad);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'class_change_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Keeps the editor link updating until a check on the game passes.
   *
   * @param description What is waited for.
   * @param check Reads the game and returns a value when satisfied, else null.
   * @returns The value the check returned.
   */
  async function gameUntil<Value>(description: string, check: () => Promise<Value | null>): Promise<Value> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const value = await check().catch(() => null);
      if (value !== null) {
        return value;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Returns the world object with the given id.
   *
   * @param id Object id.
   * @returns The object.
   */
  function objectByIdRequire(id: string): THREE.Object3D {
    const object = parts.world.getObjectByProperty('uuid', id);
    if (!object) {
      throw new Error(`No object with id ${id}`);
    }
    return object;
  }

  /**
   * Reads how many DynamicLight entities the game currently shows.
   *
   * @returns Light count.
   */
  async function gameLightCountRead(): Promise<number> {
    const rows = await previewE2eEntityRowsQuery(rig.transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]);
    return rows.length;
  }

  /**
   * Reads the Door component of the converted object, if the game has it.
   *
   * @returns The serialized door, or null.
   */
  function convertedDoorRead(): Promise<Record<string, unknown> | null> {
    return previewE2eObjectComponentRead(
      rig.transport,
      PREVIEW_E2E_GAME_ENTITY_COMPONENT,
      objectId,
      PREVIEW_E2E_DOOR_COMPONENT,
    );
  }

  it(
    'places a light the game shows, then converts it to a Door with the same id',
    async () => {
      await rig.until(
        'the game classes',
        (view) => rig.isCaughtUp(view) && GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT) !== null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      objectId = toolData<{ id: string }>(
        api.invokeTool('add_light', { name: 'HallLight', position: { x: 0, y: 2, z: 0 } }),
      ).id;
      const light = objectByIdRequire(objectId);
      await rig.until(
        'the authored light',
        (view) => rig.isCaughtUp(view) && rig.isShowingLights(view, [light]),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const changed = api.invokeTool('set_object_class', { ids: [objectId], class: PREVIEW_E2E_DOOR_COMPONENT });
      expect(changed.ok, changed.message).toBe(true);
      const converted = objectByIdRequire(objectId);
      expect(converted.uuid).toBe(objectId);
      expect(GameEntityOwner.isOwner(converted)).toBe(true);
      expect(LightOwner.isOwner(converted)).toBe(false);
      await gameUntil('the light to leave and the door to arrive', async () => {
        const lights = await gameLightCountRead();
        const door = await convertedDoorRead();
        return lights === 0 && door ? true : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'ships the Door in an exported GLB without the editor',
    async () => {
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(parts.world)));
      const shippedProject = previewE2eProjectCopy(projectDirectory);
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH],
      );
      shippedGame.start();
      try {
        const transport = new PreviewLinkTransportHttp(shippedEnvironment.endpoint);
        const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
        while (performance.now() < end) {
          const doors = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DOOR_COMPONENT]).catch(() => []);
          const lights = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]).catch(
            () => [],
          );
          if (doors.length >= 1 && lights.length === 0) {
            return;
          }
          await previewE2eSleep(250);
        }
        throw new Error('Timed out waiting for the shipped Door');
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'restores the light on undo',
    async () => {
      expect(parts.commandStack.undo()).toBe(true);
      const restored = objectByIdRequire(objectId);
      expect(LightOwner.isOwner(restored)).toBe(true);
      expect(GameEntityOwner.isOwner(restored)).toBe(false);
      await gameUntil('the light after undo', async () => {
        const lights = await gameLightCountRead();
        const door = await convertedDoorRead();
        return lights >= 1 && door === null ? true : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
