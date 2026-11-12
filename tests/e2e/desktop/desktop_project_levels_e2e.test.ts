import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';
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
 * End-to-end acceptance of project levels: the built desktop app opens a
 * temporary copy of the game project, saves the open scene into it as a new
 * level over MCP, lists it, writes a change back into it, and opens it again
 * from disk with every object back. Needs BROOM_E2E_DESKTOP_EXE,
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PROJECT_LEVELS_MCP_PORT'] ?? '18965');
const environment = previewE2eEnvironmentRead(23);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Reply of list_project_levels. */
interface DesktopE2eLevelList {
  documentDirectory: string;
  levels: ProjectLevelSummary[];
  openLevel: { id: string; document: string } | null;
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

/**
 * Returns the sorted names of the objects of a scene document.
 *
 * @param sceneText Scene document JSON text.
 * @returns Object names.
 */
function sceneObjectNamesRead(sceneText: string): string[] {
  const scene = JSON.parse(sceneText) as SceneJSON & { objects: Array<{ name?: string }> };
  return scene.objects.map((object) => object.name ?? '').sort();
}

describe.skipIf(!isConfigured)('desktop app project levels end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;
  const levelName = `E2E Level ${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Reads the open scene document of the editor.
   *
   * @returns Scene document JSON text.
   */
  async function sceneTextRead(): Promise<string> {
    return toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document')).json;
  }

  /**
   * Lists the levels of the open project.
   *
   * @returns Level list.
   */
  async function levelsList(): Promise<DesktopE2eLevelList> {
    return toolDataRead<DesktopE2eLevelList>(await client.toolCallExpectOk('list_project_levels'));
  }

  /**
   * Reads the document directory of the prepared project.
   *
   * @returns Absolute document directory.
   */
  function documentDirectoryRead(): string {
    const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as { document_directory?: string };
    return join(project.directory, definition.document_directory ?? 'broom/documents');
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `project-levels-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await client.toolCallExpectOk('project_open', { path: project.projectFile });
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    'saves the open scene into the project as a new level, writes it to disk and lists it as the open level',
    async () => {
      const sceneBefore = await sceneTextRead();
      const saved = toolDataRead<{ level: ProjectLevelSummary }>(
        await client.toolCallExpectOk('save_project_level', { name: levelName }),
      );
      expect(saved.level.name).toBe(levelName);
      const documentPath = join(documentDirectoryRead(), saved.level.document);
      expect(existsSync(documentPath)).toBe(true);
      expect(sceneObjectNamesRead(readFileSync(documentPath, 'utf8'))).toEqual(sceneObjectNamesRead(sceneBefore));
      const list = await levelsList();
      expect(list.levels.map((level) => level.document)).toContain(saved.level.document);
      expect(list.openLevel?.document).toBe(saved.level.document);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'writes a change back into the open level and reads it again after replacing the scene',
    async () => {
      const level = (await levelsList()).openLevel;
      expect(level).not.toBeNull();
      const document = level?.document ?? '';
      await client.toolCallExpectOk('create_solid_model', { name: 'E2E Saved Brush' });
      const editedNames = sceneObjectNamesRead(await sceneTextRead());
      await client.toolCallExpectOk('save_project_level');
      const onDisk = readFileSync(join(documentDirectoryRead(), document), 'utf8');
      expect(sceneObjectNamesRead(onDisk)).toEqual(editedNames);
      const emptyScene = { ...(JSON.parse(onDisk) as SceneJSON), objects: [] };
      await client.toolCallExpectOk('load_scene_document', { json: JSON.stringify(emptyScene) });
      expect(sceneObjectNamesRead(await sceneTextRead())).toEqual([]);
      await client.toolCallExpectOk('open_project_level', { document });
      expect(sceneObjectNamesRead(await sceneTextRead())).toEqual(editedNames);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'refuses to open a level the project does not have',
    async () => {
      const result = await client.toolCall('open_project_level', { levelId: 'no_such_level_e2e' });
      expect(result.ok).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
