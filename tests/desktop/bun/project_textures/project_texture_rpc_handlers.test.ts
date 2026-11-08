import { afterEach, describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { projectTextureRpcHandlersCreate } from '@/desktop/bun/project_textures/project_texture_rpc_handlers.js';
import { GameProcessSpawnerFake } from '../game_process/game_process_spawner_fake.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from './project_texture_test_files.js';

/** Texture directory of the temporary project, relative to its asset root. */
const RPC_TEST_TEXTURE_DIRECTORY = 'textures';

afterEach(() => projectTextureTestDirectoriesRemove());

/**
 * Writes a project with one texture directory into a fresh temporary directory.
 *
 * @returns Project directory and project file path.
 */
function projectCreate(): { projectDirectory: string; projectFile: string } {
  const projectDirectory = projectTextureTestAssetRootCreate();
  const project = {
    project_version: 1,
    project_id: 'texture-project',
    asset_root: 'assets',
    material_catalog: 'broom/materials.json',
    level_directory: 'broom/levels',
    texture_directories: [RPC_TEST_TEXTURE_DIRECTORY],
    preview: { program: 'cargo', arguments: ['run'], endpoint: 'http://127.0.0.1:15999' },
  };
  projectTextureTestFileWrite(projectDirectory, 'broom.project.json', JSON.stringify(project));
  return { projectDirectory, projectFile: `${projectDirectory}/broom.project.json` };
}

/** Unit tests for the desktop requests that serve the open project's textures. */
describe('projectTextureRpcHandlersCreate', () => {
  it('refuses to list or read without an open project', () => {
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    const handlers = projectTextureRpcHandlersCreate(host);
    expect(handlers.projectTextureList().ok).toBe(false);
    expect(handlers.projectTextureRead({ path: 'textures/a.png' }).ok).toBe(false);
  });

  it("lists and reads the images of the open project's texture directories", async () => {
    const { projectDirectory, projectFile } = projectCreate();
    const texturePath = `${RPC_TEST_TEXTURE_DIRECTORY}/walls/brick.png`;
    projectTextureTestFileWrite(`${projectDirectory}/assets`, texturePath, 'brick pixels');
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    expect((await host.projectOpen(projectFile)).ok).toBe(true);
    const handlers = projectTextureRpcHandlersCreate(host);
    const listed = handlers.projectTextureList();
    expect(listed).toEqual({
      ok: true,
      projectFile: host.projectDefinitionRead()?.projectFile,
      texturePaths: [texturePath],
    });
    const read = handlers.projectTextureRead({ path: texturePath });
    expect(read.ok ? Buffer.from(read.bytesBase64, 'base64').toString() : read.message).toBe('brick pixels');
  });
});
