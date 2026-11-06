import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import { PREVIEW_E2E_LOGIC_OUTPUTS_COMPONENT, previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import {
  PREVIEW_E2E_DOOR_COMPONENT,
  PREVIEW_E2E_GAME_ENTITY_COMPONENT,
  previewE2eObjectComponentRead,
} from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of entity I/O: `set_logic_outputs` reaches the game as
 * BroomLogicOutputs, undo removes it, and a shipped GLB restores it without the
 * editor. Skipped unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are
 * set; its games listen twenty and twenty-one ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(20);
const shippedEnvironment = previewE2eEnvironmentRead(21);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const PAD_SIZE = new THREE.Vector3(2, 0.5, 2);
const SHIPPED_SCENE_PATH = 'shipped/logic_outputs_level.glb';
const BUTTON_NAME = 'e2e_button';
const DOOR_NAME = 'e2e_door';

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

describe.skipIf(!environment.isConfigured)('entity I/O in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let buttonId = '';
  let doorId = '';

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
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'logic_outputs_level');
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
   * Reads the button's BroomLogicOutputs from the game.
   *
   * @param transport Transport to the game.
   * @returns Serialized outputs, or null when the button has none.
   */
  function buttonOutputsRead(transport: PreviewLinkTransportHttp): Promise<Record<string, unknown> | null> {
    return previewE2eObjectComponentRead(
      transport,
      PREVIEW_E2E_GAME_ENTITY_COMPONENT,
      buttonId,
      PREVIEW_E2E_LOGIC_OUTPUTS_COMPONENT,
    );
  }

  /**
   * Returns whether a serialized outputs component fires Open at the named
   * door.
   *
   * @param outputs Serialized BroomLogicOutputs.
   * @returns True when the expected connection is present.
   */
  function outputsOpenDoorIs(outputs: Record<string, unknown> | null): boolean {
    const connections = (outputs?.['connections'] as Array<{ output?: string; target?: string; input?: string }>) ?? [];
    return connections.some((row) => row.output === 'OnPressed' && row.target === DOOR_NAME && row.input === 'Open');
  }

  it(
    'places two named doors and waits for the game classes',
    async () => {
      await rig.until(
        'the game classes',
        (view) => rig.isCaughtUp(view) && GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT) !== null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      buttonId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', {
          class: PREVIEW_E2E_DOOR_COMPONENT,
          name: BUTTON_NAME,
          position: { x: -1, y: 0, z: 0 },
        }),
      ).id;
      doorId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', {
          class: PREVIEW_E2E_DOOR_COMPONENT,
          name: DOOR_NAME,
          position: { x: 1, y: 0, z: 0 },
        }),
      ).id;
      expect(buttonId).not.toBe(doorId);
      await gameUntil('both doors in the game', async () => {
        const rows = await previewE2eEntityRowsQuery(rig.transport, [PREVIEW_E2E_GAME_ENTITY_COMPONENT]);
        return rows.length >= 2 ? true : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'sends an output row to the game and removes it on undo',
    async () => {
      toolData(
        api.invokeTool('set_logic_outputs', {
          id: buttonId,
          outputs: [{ output: 'OnPressed', target: DOOR_NAME, input: 'Open' }],
        }),
      );
      await gameUntil('BroomLogicOutputs on the button', async () => {
        const outputs = await buttonOutputsRead(rig.transport);
        return outputsOpenDoorIs(outputs) ? outputs : null;
      });
      expect(parts.commandStack.undo()).toBe(true);
      await gameUntil('BroomLogicOutputs to be gone', async () =>
        (await buttonOutputsRead(rig.transport)) === null ? true : null,
      );
      expect(parts.commandStack.redo()).toBe(true);
      await gameUntil('BroomLogicOutputs after redo', async () => {
        const outputs = await buttonOutputsRead(rig.transport);
        return outputsOpenDoorIs(outputs) ? outputs : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'ships the outputs in an exported GLB without the editor',
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
        await shippedOutputsWait(new PreviewLinkTransportHttp(shippedEnvironment.endpoint));
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  /**
   * Waits until the shipped game shows BroomLogicOutputs.
   *
   * @param transport Transport to the shipped game.
   */
  async function shippedOutputsWait(transport: PreviewLinkTransportHttp): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_LOGIC_OUTPUTS_COMPONENT]).catch(() => []);
      if (
        rows.some((row) =>
          outputsOpenDoorIs(row.components[PREVIEW_E2E_LOGIC_OUTPUTS_COMPONENT] as Record<string, unknown>),
        )
      ) {
        return;
      }
      await previewE2eSleep(250);
    }
    throw new Error('Timed out waiting for shipped BroomLogicOutputs');
  }
});
