import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { isImageFileName } from '@/texture/library/image_file_filter.js';
import { TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES } from '@/texture/library/texture_library_source.js';
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
 * End-to-end acceptance of project texture directories: the built desktop app
 * opens a temporary copy of the game project whose texture_directories name the
 * shipped textures folder and a folder the test fills, and its Texture Browser
 * lists every image of both under its asset-relative id, picking up a new image
 * when the project is opened again. Needs BROOM_E2E_DESKTOP_EXE,
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PROJECT_TEXTURES_MCP_PORT'] ?? '19025');
const environment = previewE2eEnvironmentRead(22);
const isConfigured = desktopExecutable !== '' && environment.isConfigured;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Texture directory the test creates, relative to the asset root. */
const E2E_TEXTURE_DIRECTORY = 'e2e_textures';

/** A valid one-pixel PNG. */
const E2E_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** One entry of a texture_browser_entries reply. */
interface DesktopE2eTextureEntry {
  id: string;
  displayName: string;
  source: string;
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
 * Reads the asset root of a prepared project from its project file.
 *
 * @param project Prepared project.
 * @returns Absolute asset root.
 */
function projectAssetRootRead(project: DesktopE2eProject): string {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as { asset_root: string };
  return join(project.directory, definition.asset_root);
}

/**
 * Lists the images below a directory of the asset root, recursively.
 *
 * @param assetRoot Absolute asset root.
 * @param relativeDirectory Directory relative to the asset root, forward
 *   slashes.
 * @returns Asset-relative image paths, forward slashes.
 */
function imagePathsList(assetRoot: string, relativeDirectory: string): string[] {
  const absoluteDirectory = join(assetRoot, relativeDirectory);
  return readdirSync(absoluteDirectory, { recursive: true, encoding: 'utf8' })
    .filter((path) => isImageFileName(path) && statSync(join(absoluteDirectory, path)).isFile())
    .map((path) => `${relativeDirectory}/${path.replace(/\\/g, '/')}`);
}

/**
 * Writes the test PNG under the asset root.
 *
 * @param assetRoot Absolute asset root.
 * @param relativePath Asset-relative path, forward slashes.
 */
function imageWrite(assetRoot: string, relativePath: string): void {
  const filePath = join(assetRoot, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, E2E_PNG_BYTES);
}

/**
 * Adds the test texture directory to the project's texture directories.
 *
 * @param project Prepared project.
 * @returns Texture directories now named by the project file.
 */
function projectTextureDirectoriesExtend(project: DesktopE2eProject): string[] {
  const definition = JSON.parse(readFileSync(project.projectFile, 'utf8')) as Record<string, unknown>;
  const shipped = Array.isArray(definition['texture_directories'])
    ? (definition['texture_directories'] as string[])
    : [];
  definition['texture_directories'] = [...shipped, E2E_TEXTURE_DIRECTORY];
  writeFileSync(project.projectFile, JSON.stringify(definition, null, 2));
  return [...shipped, E2E_TEXTURE_DIRECTORY];
}

describe.skipIf(!isConfigured)('desktop app project texture directories end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;
  let assetRoot = '';
  let textureDirectories: string[] = [];

  /**
   * Waits until the Texture Browser lists every given id as a project texture.
   *
   * @param expectedIds Asset-relative ids that must be listed.
   * @returns Project texture entries once all are listed.
   */
  async function projectEntriesWait(expectedIds: readonly string[]): Promise<DesktopE2eTextureEntry[]> {
    return desktopE2eWaitUntil(
      `the Texture Browser to list ${expectedIds.join(', ')}`,
      async () => {
        const reply = toolDataRead<{ entries: DesktopE2eTextureEntry[] }>(
          await client.toolCallExpectOk('texture_browser_entries'),
        );
        const projectEntries = reply.entries.filter(
          (entry) => entry.source === TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES,
        );
        const listedIds = new Set(projectEntries.map((entry) => entry.id));
        return expectedIds.every((id) => listedIds.has(id)) ? projectEntries : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `project-textures-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    textureDirectories = projectTextureDirectoriesExtend(project);
    assetRoot = projectAssetRootRead(project);
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    'lists every image of the texture directories under its asset-relative id when the project opens',
    async () => {
      const probePath = `${E2E_TEXTURE_DIRECTORY}/probe/e2e_probe_first.png`;
      imageWrite(assetRoot, probePath);
      const expectedIds = textureDirectories.flatMap((directory) => imagePathsList(assetRoot, directory));
      expect(expectedIds).toContain(probePath);
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      const projectEntries = await projectEntriesWait(expectedIds);
      expect(projectEntries.map((entry) => entry.id).sort()).toEqual([...expectedIds].sort());
      expect(projectEntries.find((entry) => entry.id === probePath)?.displayName).toBe('e2e_probe_first');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'picks up a new image when the project is opened again',
    async () => {
      const addedPath = `${E2E_TEXTURE_DIRECTORY}/e2e_probe_added.png`;
      imageWrite(assetRoot, addedPath);
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      const projectEntries = await projectEntriesWait([addedPath]);
      expect(projectEntries.some((entry) => entry.id === `${E2E_TEXTURE_DIRECTORY}/probe/e2e_probe_first.png`)).toBe(
        true,
      );
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
