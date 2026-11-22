import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { LEVEL_BUILD_MANIFEST_FILE_NAME } from '@/level_build/manifest/level_build_manifest.js';
import type { RunConfigurationRunState } from '@/project/run_configuration/run/run_configuration_run_state.js';
import { RUN_CONFIGURATIONS_PROJECT_KEY } from '@/project/run_configuration/model/run_configuration_types.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of run configurations in the built desktop app: a
 * configuration stored through MCP lands in the project file, and running it
 * saves the open level, builds its package and runs a command with the level
 * placeholders replaced, like a light bake would; a failing command fails the
 * run with its exit code. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher and the preview project is configured.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_RUN_CONFIGURATIONS_MCP_PORT'] ?? '19225');
const environment = previewE2eEnvironmentRead(35);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 120000;
const MARKER_FILE_NAME = 'run_configuration_marker.txt';

/** Script the command step runs: writes its arguments into the marker file. */
const MARKER_SCRIPT = "require('fs').writeFileSync(process.argv[1], process.argv.slice(2).join('|'))";

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

describe.skipIf(!isConfigured)('desktop app run configurations end to end', () => {
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

  /**
   * Builds a small scene and saves it as a new level of the project.
   *
   * @returns Id of the saved level.
   */
  async function levelCreate(): Promise<string> {
    const model = await client.toolCallExpectOk('create_solid_model', { name: 'RunConfigurationHall' });
    const modelId = toolDataRead<{ modelId: string }>(model).modelId;
    await client.toolCallExpectOk('add_box_brush', { modelId, size: 2, position: { x: 0, y: -1, z: 0 } });
    await client.toolCallExpectOk('add_light', { position: { x: 0, y: 3, z: 0 }, settings: { radius: 6 } });
    const saved = await client.toolCallExpectOk('save_project_level', { name: 'Run Configuration Hall' });
    return toolDataRead<{ level: { id: string } }>(saved).level.id;
  }

  /**
   * Runs a configuration and waits until its run ended.
   *
   * @param configurationId Configuration to run.
   * @returns Final run state.
   */
  async function configurationRun(configurationId: string): Promise<RunConfigurationRunState> {
    await client.toolCallExpectOk('run_configuration', { configurationId });
    return desktopE2eWaitUntil(
      `run configuration ${configurationId} to end`,
      async () => {
        const listed = await client.toolCallExpectOk('list_run_configurations');
        const runState = toolDataRead<{ runState: RunConfigurationRunState | null }>(listed).runState;
        const isEnded = runState?.configurationId === configurationId && runState.phase !== 'running';
        return isEnded ? runState : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: 'run-configurations-e2e',
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
    'stores a bake-like configuration in the project and runs its level and command steps',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      const levelId = await levelCreate();
      const markerPath = `{project_directory}/${MARKER_FILE_NAME}`;
      await client.toolCallExpectOk('set_run_configurations', {
        configurations: [
          {
            id: 'bake_e2e',
            name: 'Bake E2E',
            steps: [
              { kind: 'level_save' },
              { kind: 'level_package_build' },
              {
                kind: 'command',
                program: 'bun',
                arguments: ['-e', MARKER_SCRIPT, markerPath, '{level_id}', '{level_export_directory}'],
              },
            ],
          },
          {
            id: 'failing_e2e',
            name: 'Failing E2E',
            steps: [{ kind: 'command', program: 'bun', arguments: ['-e', 'process.exit(3)'] }],
          },
        ],
        activeId: 'bake_e2e',
      });
      const stored = JSON.parse(readFileSync(project.projectFile, 'utf8')) as Record<string, unknown>;
      expect((stored[RUN_CONFIGURATIONS_PROJECT_KEY] as unknown[]).length).toBe(2);
      expect((await configurationRun('bake_e2e')).phase).toBe('succeeded');
      const [markerLevelId, exportDirectory] = readFileSync(join(project.directory, MARKER_FILE_NAME), 'utf8').split(
        '|',
      );
      expect(markerLevelId).toBe(levelId);
      expect(existsSync(join(exportDirectory ?? '', LEVEL_BUILD_MANIFEST_FILE_NAME))).toBe(true);
      const failed = await configurationRun('failing_e2e');
      expect(failed.phase).toBe('failed');
      expect(failed.message).toContain('3');
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
