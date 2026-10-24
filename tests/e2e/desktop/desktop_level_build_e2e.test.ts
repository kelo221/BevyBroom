import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  LEVEL_BUILD_MANIFEST_VERSION,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { PreviewE2eGameProcess, previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import {
  PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
  PREVIEW_E2E_ROOM_COMPONENT,
  previewE2eEntityRowsQuery,
} from '../preview_e2e_game_query.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of Build Level: the desktop app builds a level with a
 * solid floor, a room cell and a light into a temporary game project, and a
 * fresh game process loads the package with --level and no editor attached.
 * Interrupted builds keeping the last package are unit tested. Needs
 * BROOM_E2E_DESKTOP_EXE, BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_LEVEL_BUILD_MCP_PORT'] ?? '18945');
const environment = previewE2eEnvironmentRead(14);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 120000;
const LEVEL_NAME = 'e2e_built_hall';

/** Data of a successful build_level reply. */
interface LevelBuildE2eResult {
  levelName: string;
  levelDirectory: string;
  geometryFile: string;
  objectCount: number;
}

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

describe.skipIf(!isConfigured)('desktop app Build Level end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;

  /** Starts the app and waits until the editor answers tools. */
  async function appLaunch(): Promise<void> {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  /** Builds the scene: a solid floor, a room cell and a light. */
  async function sceneBuild(): Promise<void> {
    const model = await client.toolCallExpectOk('create_solid_model', { name: 'BuiltHall' });
    const modelId = toolDataRead<{ modelId: string }>(model).modelId;
    await client.toolCallExpectOk('add_box_brush', { modelId, size: 2, position: { x: 0, y: -1, z: 0 } });
    await client.toolCallExpectOk('add_room', {
      position: { x: 0, y: 2, z: 0 },
      settings: { halfSizeX: 4, halfSizeY: 2, halfSizeZ: 4 },
    });
    await client.toolCallExpectOk('add_light', { position: { x: 0, y: 3, z: 0 }, settings: { radius: 6 } });
  }

  /**
   * Waits until a game shows the given number of rooms and lights.
   *
   * @param transport Transport to the game's bridge.
   * @returns Room and light counts once both are shown.
   */
  async function cellsAndLightsWait(transport: PreviewLinkTransportHttp): Promise<{ rooms: number; lights: number }> {
    return desktopE2eWaitUntil(
      'the built level to show its room and light',
      async () => {
        const rooms = (await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_ROOM_COMPONENT]).catch(() => [])).length;
        const lights = (
          await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]).catch(() => [])
        ).length;
        return rooms >= 1 && lights >= 1 ? { rooms, lights } : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: 'level-build-e2e',
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    previewE2eProjectRemove(project.directory);
  });

  it(
    'builds a level package that a fresh game loads with no editor attached',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      await sceneBuild();
      const built = toolDataRead<LevelBuildE2eResult>(
        await client.toolCallExpectOk('build_level', { levelName: LEVEL_NAME }),
      );
      expect(built.levelName).toBe(LEVEL_NAME);
      const manifest = JSON.parse(
        readFileSync(`${built.levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`, 'utf8'),
      ) as LevelBuildManifest;
      expect(manifest.manifest_version).toBe(LEVEL_BUILD_MANIFEST_VERSION);
      expect(manifest.geometry_file).toBe(built.geometryFile);
      expect(existsSync(`${built.levelDirectory}/${built.geometryFile}`)).toBe(true);
      await app.stop();
      const game = new PreviewE2eGameProcess(
        environment.previewExecutable,
        project.directory,
        environment.bridgePort,
        e2eWindowsShownRead(),
        ['--level', LEVEL_NAME],
      );
      game.start();
      try {
        const shown = await cellsAndLightsWait(new PreviewLinkTransportHttp(environment.endpoint));
        expect(shown).toEqual({ rooms: 1, lights: 1 });
      } finally {
        await game.stop();
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
