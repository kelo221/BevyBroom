import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GAME_PROCESS_NO_PREVIEW_REFUSAL } from '@/desktop/bun/game_process/game_process_host.js';
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
 * End-to-end acceptance of project classes, project prefabs and a project file
 * without a preview section: the built desktop app opens a temporary copy of
 * the game project whose file names a class file and a prefab directory and no
 * preview program. The declared classes show without the game, a class written
 * over MCP lands in the file, a prefab created from brushes is written as a
 * file, and after the app restarts the prefab is listed and placed again. Needs
 * BROOM_E2E_DESKTOP_EXE, BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PROJECT_DATA_MCP_PORT'] ?? '19005');
const environment = previewE2eEnvironmentRead(26);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Class file path relative to the project file. */
const CLASS_FILE = 'broom/entity_classes.json';

/** Prefab directory relative to the project file. */
const PREFAB_DIRECTORY = 'broom/prefabs';

/** Type path of the class the class file declares before the app starts. */
const DECLARED_CLASS_TYPE_PATH = 'e2e_game::level::Shelf';

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
 * Rewrites the prepared project file: no preview section, a class file with one
 * declared class, and a prefab directory.
 *
 * @param project Prepared project.
 */
function projectDataFieldsWrite(project: DesktopE2eProject): void {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as Record<string, unknown>;
  delete definition['preview'];
  definition['entity_classes'] = CLASS_FILE;
  definition['prefab_directory'] = PREFAB_DIRECTORY;
  writeFileSync(project.projectFile, JSON.stringify(definition, null, 2));
  const classFile = join(project.directory, CLASS_FILE);
  mkdirSync(dirname(classFile), { recursive: true });
  const shelf = { type_path: DECLARED_CLASS_TYPE_PATH, label: 'E2E Shelf', category: 'E2E', placement: 'point' };
  writeFileSync(classFile, JSON.stringify({ classes: [shelf] }));
}

describe.skipIf(!isConfigured)('desktop app project classes and prefabs end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;
  let prefabId = '';

  /** Starts the app, connects the MCP client and opens the project. */
  async function appStartAndProjectOpen(): Promise<void> {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await client.toolCallExpectOk('project_open', { path: project.projectFile });
  }

  /**
   * Counts the brushes of every solid model in the open scene.
   *
   * @returns Brush total.
   */
  async function brushTotalRead(): Promise<number> {
    const listed = toolDataRead<{ models: { brushCount: number }[] }>(
      await client.toolCallExpectOk('list_solid_models'),
    );
    return listed.models.reduce((total, model) => total + model.brushCount, 0);
  }

  /**
   * Waits until list_prefabs lists a prefab id.
   *
   * @param id Prefab id.
   */
  async function prefabListedWait(id: string): Promise<void> {
    await desktopE2eWaitUntil(
      `prefab ${id} to be listed`,
      async () => {
        const listed = toolDataRead<{ prefabs: { id: string }[] }>(await client.toolCallExpectOk('list_prefabs'));
        return listed.prefabs.some((prefab) => prefab.id === id) ? true : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `project-data-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    projectDataFieldsWrite(project);
    await appStartAndProjectOpen();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    'opens the project without a preview section and refuses to start its game',
    async () => {
      const status = toolDataRead<{ project: { canLaunch: boolean } | null }>(
        await client.toolCallExpectOk('project_status'),
      );
      expect(status.project?.canLaunch).toBe(false);
      const launch = await client.toolCall('game_launch');
      expect(launch.message).toBe(GAME_PROCESS_NO_PREVIEW_REFUSAL);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'shows the declared classes without the game and writes a new class into the class file',
    async () => {
      await desktopE2eWaitUntil(
        'the declared class to be known',
        async () => {
          const classes = toolDataRead<{ classes: { type_path: string }[] }>(
            await client.toolCallExpectOk('list_game_classes'),
          );
          return classes.classes.some((entry) => entry.type_path === DECLARED_CLASS_TYPE_PATH) ? true : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      const finishZone = { type_path: 'e2e_game::level::FinishZone', label: 'E2E Finish', placement: 'any' };
      await client.toolCallExpectOk('set_project_class', { class: finishZone });
      const fileText = readFileSync(join(project.directory, CLASS_FILE), 'utf8');
      expect(fileText).toContain(finishZone.type_path);
      expect(fileText).toContain(DECLARED_CLASS_TYPE_PATH);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'creates a prefab from brushes and writes it as a JSON file in the prefab directory',
    async () => {
      const modelId = toolDataRead<{ modelId: string }>(
        await client.toolCallExpectOk('create_solid_model', { name: 'E2E Prefab Source' }),
      ).modelId;
      const added = await client.toolCallExpectOk('add_box_brush', {
        modelId,
        size: 2,
        position: { x: 3, y: 1, z: 0 },
      });
      await client.toolCallExpectOk('select', { brushIds: [toolDataRead<{ brushId: string }>(added).brushId] });
      const created = await client.toolCallExpectOk('create_prefab', { name: 'E2E Shelf Row', category: 'E2E' });
      prefabId = toolDataRead<{ id: string }>(created).id;
      const prefabFile = join(project.directory, PREFAB_DIRECTORY, `${prefabId}.json`);
      await desktopE2eWaitUntil(
        'the prefab file',
        async () => (existsSync(prefabFile) ? true : null),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const file = JSON.parse(readFileSync(prefabFile, 'utf8')) as {
        format: string;
        payload: { brushes: { brushes: unknown[] } };
      };
      expect(file.format).toBe('bevybroom.prefab');
      expect(file.payload.brushes.brushes.length).toBe(1);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'lists and places the prefab again after the app restarts',
    async () => {
      await app.stop();
      await appStartAndProjectOpen();
      await prefabListedWait(prefabId);
      const brushCountBefore = await brushTotalRead();
      const placed = await client.toolCallExpectOk('place_prefab', { prefabId, position: { x: 20, y: 0, z: 0 } });
      expect(placed.createdIds?.length).toBe(1);
      expect(await brushTotalRead()).toBe(brushCountBefore + 1);
    },
    LAUNCH_TIMEOUT_MILLISECONDS * 2,
  );
});
