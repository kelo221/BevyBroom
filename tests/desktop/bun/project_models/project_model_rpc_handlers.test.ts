import { afterEach, describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { projectModelRpcHandlersCreate } from '@/desktop/bun/project_models/project_model_rpc_handlers.js';
import { GameProcessSpawnerFake } from '../game_process/game_process_spawner_fake.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/**
 * Writes a project whose asset root is a subdirectory into a fresh temporary
 * directory.
 *
 * @returns Project directory and project file path.
 */
function projectCreate(): { projectDirectory: string; projectFile: string } {
  const projectDirectory = projectTextureTestAssetRootCreate();
  const project = {
    project_version: 1,
    project_id: 'model-project',
    asset_root: 'assets',
    level_directory: 'levels',
    preview: { program: 'cargo', arguments: ['run'], endpoint: 'http://127.0.0.1:15999' },
  };
  projectTextureTestFileWrite(projectDirectory, 'broom.project.json', JSON.stringify(project));
  return { projectDirectory, projectFile: `${projectDirectory}/broom.project.json` };
}

/** Unit tests for the desktop request that serves the open project's models. */
describe('projectModelRpcHandlersCreate', () => {
  it('refuses to read without an open project', () => {
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    expect(projectModelRpcHandlersCreate(host).projectModelRead({ path: 'models/a.glb' }).ok).toBe(false);
  });

  it("reads a model relative to the open project's asset root", async () => {
    const { projectDirectory, projectFile } = projectCreate();
    const modelPath = 'models/props/crate.glb';
    projectTextureTestFileWrite(`${projectDirectory}/assets`, modelPath, 'crate bytes');
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    expect((await host.projectOpen(projectFile)).ok).toBe(true);
    const read = projectModelRpcHandlersCreate(host).projectModelRead({ path: modelPath });
    expect(read.ok ? Buffer.from(read.bytesBase64, 'base64').toString() : read.message).toBe('crate bytes');
  });
});
