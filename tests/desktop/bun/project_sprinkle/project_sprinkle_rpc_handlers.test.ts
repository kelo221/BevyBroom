import { afterEach, describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { ProjectSprinkleDefinitionOpener } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_opener.js';
import { ProjectSprinkleDefinitionReader } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_reader.js';
import { projectSprinkleRpcHandlersCreate } from '@/desktop/bun/project_sprinkle/project_sprinkle_rpc_handlers.js';
import { GameProcessSpawnerFake } from '../game_process/game_process_spawner_fake.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

/** Sprinkle directory of the temporary project, relative to its asset root. */
const RPC_TEST_SPRINKLE_DIRECTORY = 'sprinkle';

afterEach(() => projectTextureTestDirectoriesRemove());

/**
 * Writes a project with one sprinkle directory into a fresh temporary
 * directory.
 *
 * @returns Project directory and project file path.
 */
function projectCreate(): { projectDirectory: string; projectFile: string } {
  const projectDirectory = projectTextureTestAssetRootCreate();
  const project = {
    project_version: 1,
    project_id: 'sprinkle-project',
    asset_root: 'assets',
    material_catalog: 'broom/materials.json',
    level_directory: 'broom/levels',
    sprinkle_directories: [RPC_TEST_SPRINKLE_DIRECTORY],
    preview: { program: 'cargo', arguments: ['run'], endpoint: 'http://127.0.0.1:15999' },
  };
  projectTextureTestFileWrite(projectDirectory, 'broom.project.json', JSON.stringify(project));
  return { projectDirectory, projectFile: `${projectDirectory}/broom.project.json` };
}

/**
 * Creates handlers whose opener records the paths it was asked to open.
 *
 * @param host Host that knows the open project.
 * @returns Handlers and the recorded paths.
 */
function handlersRecordingCreate(host: GameProcessHost) {
  const openedPaths: string[] = [];
  const opener = new ProjectSprinkleDefinitionOpener(async (absolutePath) => {
    openedPaths.push(absolutePath);
  });
  const handlers = projectSprinkleRpcHandlersCreate(host, { reader: new ProjectSprinkleDefinitionReader(), opener });
  return { handlers, openedPaths };
}

/**
 * Unit tests for the desktop requests that serve the open project's sprinkle
 * definitions.
 */
describe('projectSprinkleRpcHandlersCreate', () => {
  it('refuses to read or open without an open project', async () => {
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    const { handlers, openedPaths } = handlersRecordingCreate(host);
    expect(handlers.projectSprinkleDefinitionFilesRead().ok).toBe(false);
    expect((await handlers.projectSprinkleDefinitionOpen({ path: 'sprinkle/a.txt' })).ok).toBe(false);
    expect(openedPaths).toEqual([]);
  });

  it("reads and opens the definition files of the open project's sprinkle directories", async () => {
    const { projectDirectory, projectFile } = projectCreate();
    const definitionPath = `${RPC_TEST_SPRINKLE_DIRECTORY}/plants.txt`;
    const definitionText = 'Plants { base { classname plant } 1 { } }';
    projectTextureTestFileWrite(`${projectDirectory}/assets`, definitionPath, definitionText);
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    expect((await host.projectOpen(projectFile)).ok).toBe(true);
    const { handlers, openedPaths } = handlersRecordingCreate(host);
    expect(handlers.projectSprinkleDefinitionFilesRead()).toEqual({
      ok: true,
      files: [{ path: definitionPath, text: definitionText }],
    });
    expect(await handlers.projectSprinkleDefinitionOpen({ path: definitionPath })).toEqual({ ok: true });
    expect(openedPaths).toHaveLength(1);
    expect(openedPaths[0]?.replace(/\\/g, '/').endsWith(definitionPath)).toBe(true);
  });
});
