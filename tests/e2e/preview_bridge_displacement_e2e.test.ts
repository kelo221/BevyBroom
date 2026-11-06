import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { PREVIEW_E2E_NAME_COMPONENT, previewE2eEntityRowsQuery, previewE2eNameRead } from './preview_e2e_game_query.js';
import { displacementSurfaceMeshNameBuild } from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/**
 * End-to-end acceptance of displacements: `set_face_displacement` shows a
 * `displacement:<brushId>:<face>` mesh in the live game, undo removes it, redo
 * restores it, and a shipped GLB still carries it. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen
 * sixteen and seventeen ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(16);
const shippedEnvironment = previewE2eEnvironmentRead(17);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const SHIPPED_SCENE_PATH = 'shipped/displacement_level.glb';

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

describe.skipIf(!environment.isConfigured)('displacements in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let brushId = '';
  let displacementName = '';

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
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'displacement_level');
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
   * Returns whether the game has a named displacement mesh.
   *
   * @param transport Transport to the game.
   * @param name Displacement mesh name.
   * @returns True when a Name matches.
   */
  async function displacementNamedIs(transport: PreviewLinkTransportHttp, name: string): Promise<boolean> {
    const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_NAME_COMPONENT]);
    return rows.some((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT]) === name);
  }

  it(
    'creates a solid and a power-2 displacement the game shows by name',
    async () => {
      await rig.until('the live game', (view) => rig.isCaughtUp(view), STEP_TIMEOUT_MILLISECONDS);
      const created = toolData<{ modelId: string; brushId: string }>(
        api.invokeTool('create_solid_model', { name: 'DisplacementPad' }),
      );
      brushId = created.brushId;
      displacementName = displacementSurfaceMeshNameBuild({ brushId, surfaceIndex: 0 });
      toolData(
        api.invokeTool('set_face_displacement', {
          brushId,
          faceIndex: 0,
          action: 'create',
          power: 2,
          elevation: 0.5,
        }),
      );
      await gameUntil('the displacement mesh', async () =>
        (await displacementNamedIs(rig.transport, displacementName)) ? true : null,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'removes the displacement on undo and restores it on redo',
    async () => {
      expect(parts.commandStack.undo()).toBe(true);
      await gameUntil('the displacement mesh to be gone', async () =>
        (await displacementNamedIs(rig.transport, displacementName)) ? null : true,
      );
      expect(parts.commandStack.redo()).toBe(true);
      await gameUntil('the displacement mesh after redo', async () =>
        (await displacementNamedIs(rig.transport, displacementName)) ? true : null,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'ships the displacement mesh in an exported GLB without the editor',
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
          if (await displacementNamedIs(transport, displacementName).catch(() => false)) {
            return;
          }
          await previewE2eSleep(250);
        }
        throw new Error(`Timed out waiting for shipped ${displacementName}`);
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
