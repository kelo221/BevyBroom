import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';
import type { GameProcessStatus } from '@/project/process/game_process_types.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { LEVEL_BUILD_MANIFEST_FILE_NAME } from '@/level_build/manifest/level_build_manifest.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import { PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT, previewE2eEntityRowsQuery } from '../preview_e2e_game_query.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of starting the game in the open level: the project's
 * preview arguments name `{level_id}`, the desktop app saves two project levels
 * with a different number of lights, opens the second and launches the game.
 * The game shows the second level's lights, read from its freshly built
 * package. A light added and saved afterwards is in the game after a restart.
 * The editor's live link points at a port nothing listens on, so everything the
 * game shows comes from the level package. Needs BROOM_E2E_DESKTOP_EXE,
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PLAY_LEVEL_MCP_PORT'] ?? '19165');
const environment = previewE2eEnvironmentRead(31);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 180000;
const UNREACHABLE_LINK_PORT_OFFSET = 40;

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

/**
 * Makes the prepared project start the game in the open level and points the
 * editor's live link at a port the game does not listen on.
 *
 * @param project Prepared project.
 */
function projectLevelLaunchWrite(project: DesktopE2eProject): void {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as {
    preview: { arguments: string[]; endpoint: string };
  };
  definition.preview.arguments.push('--level', '{level_id}');
  definition.preview.endpoint = `http://127.0.0.1:${environment.bridgePort + UNREACHABLE_LINK_PORT_OFFSET}`;
  writeFileSync(project.projectFile, JSON.stringify(definition, null, 2));
}

/**
 * Reads the absolute document directory of a prepared project.
 *
 * @param project Prepared project.
 * @returns Document directory with forward slashes.
 */
function projectDocumentDirectoryRead(project: DesktopE2eProject): string {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as { document_directory?: string };
  return `${project.directory}/${definition.document_directory ?? 'broom/documents'}`;
}

describe.skipIf(!isConfigured)('desktop app starts the game in the open level end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  const transport = new PreviewLinkTransportHttp(environment.endpoint);
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;

  /**
   * Reads the document directory of the prepared project.
   *
   * @returns Absolute document directory.
   */
  function levelDocumentDirectoryRead(): string {
    return projectDocumentDirectoryRead(project);
  }

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

  /** Replaces the open scene with an empty one that belongs to no level. */
  async function sceneEmpty(): Promise<void> {
    const sceneText = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document')).json;
    const emptyScene = { ...(JSON.parse(sceneText) as SceneJSON), objects: [] };
    await client.toolCallExpectOk('load_scene_document', { json: JSON.stringify(emptyScene) });
  }

  /**
   * Adds lights in a row above the origin.
   *
   * @param count Number of lights to add.
   * @param firstIndex Index of the first light, so rows do not overlap.
   */
  async function lightsAdd(count: number, firstIndex: number): Promise<void> {
    for (let index = firstIndex; index < firstIndex + count; index += 1) {
      await client.toolCallExpectOk('add_light', { position: { x: index * 2, y: 3, z: 0 }, settings: { radius: 4 } });
    }
  }

  /**
   * Saves a fresh scene with a number of lights as a new project level.
   *
   * @param name Level name.
   * @param lightCount Number of lights in the level.
   * @returns The saved level.
   */
  async function levelSave(name: string, lightCount: number): Promise<ProjectLevelSummary> {
    await sceneEmpty();
    await lightsAdd(lightCount, 0);
    const saved = await client.toolCallExpectOk('save_project_level', { name });
    return toolDataRead<{ level: ProjectLevelSummary }>(saved).level;
  }

  /**
   * Waits until the game shows exactly a number of lights.
   *
   * @param lightCount Expected number of lights.
   * @returns The number of lights shown.
   */
  async function gameLightsWait(lightCount: number): Promise<number> {
    return desktopE2eWaitUntil(
      `the game to show ${lightCount} lights`,
      async () => {
        const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]).catch(
          () => null,
        );
        return rows !== null && rows.length === lightCount ? rows.length : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Waits until the managed game runs.
   *
   * @returns Status of the running game.
   */
  async function gameRunningWait(): Promise<GameProcessStatus & { launchLevelId: string | null }> {
    return desktopE2eWaitUntil(
      'the game to run',
      async () => {
        const status = toolDataRead<GameProcessStatus & { launchLevelId: string | null }>(
          await client.toolCallExpectOk('project_status'),
        );
        return status.phase === 'running' ? status : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `play-level-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    projectLevelLaunchWrite(project);
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await client?.toolCall('game_stop').catch(() => undefined);
    await app.stop();
    previewE2eProjectRemove(project.directory);
  });

  it(
    'starts the game in the open level, built fresh, and a saved change is in the game after the next start',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      const firstLevel = await levelSave('E2E Play First', 1);
      const secondLevel = await levelSave('E2E Play Second', 2);
      expect(secondLevel.id).not.toBe(firstLevel.id);
      await sceneEmpty();
      await client.toolCallExpectOk('open_project_level', { document: secondLevel.document });
      await client.toolCallExpectOk('game_launch');
      const running = await gameRunningWait();
      expect(running.launchLevelId).toBe(secondLevel.id);
      expect(await gameLightsWait(2)).toBe(2);
      const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as {
        asset_root: string;
        level_directory: string;
      };
      const levelDirectory = `${project.directory}/${definition.asset_root}/${definition.level_directory}`;
      expect(existsSync(`${levelDirectory}/${secondLevel.id}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`)).toBe(true);
      await lightsAdd(1, 2);
      await client.toolCallExpectOk('game_play_level');
      expect(await gameLightsWait(3)).toBe(3);
      const documentText = readFileSync(`${levelDocumentDirectoryRead()}/${secondLevel.document}`, 'utf8');
      const editorText = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document')).json;
      const objectCountRead = (text: string) => (JSON.parse(text) as SceneJSON).objects.length;
      expect(objectCountRead(documentText)).toBe(objectCountRead(editorText));
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );
});
