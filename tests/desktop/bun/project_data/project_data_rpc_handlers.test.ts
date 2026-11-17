import { afterEach, describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { ProjectDataFileStore } from '@/desktop/bun/project_data/project_data_file_store.js';
import { projectDataRpcHandlersCreate } from '@/desktop/bun/project_data/project_data_rpc_handlers.js';
import { GameProcessSpawnerFake } from '../game_process/game_process_spawner_fake.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

/** Prefab folder of the temporary project, relative to its project file. */
const RPC_TEST_PREFAB_DIRECTORY = 'broom/prefabs';

afterEach(() => projectTextureTestDirectoriesRemove());

/**
 * Writes a project with a prefab folder into a fresh temporary directory and
 * opens it.
 *
 * @returns Host with the project open, and the project directory.
 */
async function projectOpen(): Promise<{ host: GameProcessHost; projectDirectory: string }> {
  const projectDirectory = projectTextureTestAssetRootCreate();
  const project = {
    project_id: 'prefab-project',
    asset_root: '.',
    level_directory: 'levels',
    prefab_directory: RPC_TEST_PREFAB_DIRECTORY,
  };
  projectTextureTestFileWrite(projectDirectory, 'broom.project.json', JSON.stringify(project));
  const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
  const opened = await host.projectOpen(`${projectDirectory}/broom.project.json`);
  if (!opened.ok) throw new Error(opened.message);
  return { host, projectDirectory };
}

/** The desktop requests that change and show the open project's data files. */
describe('projectDataRpcHandlersCreate', () => {
  it('reveals an existing prefab file by its absolute path', async () => {
    const { host } = await projectOpen();
    const revealed: string[] = [];
    const handlers = projectDataRpcHandlersCreate(host, new ProjectDataFileStore(), async (path) => {
      revealed.push(path);
    });
    expect(handlers.projectDataFileWrite({ kind: 'prefabs', name: 'kiosk.json', text: '{}' })).toEqual({ ok: true });
    expect(await handlers.projectDataFileReveal({ kind: 'prefabs', name: 'kiosk.json' })).toEqual({ ok: true });
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.endsWith(`${RPC_TEST_PREFAB_DIRECTORY}/kiosk.json`)).toBe(true);
  });

  it('refuses to reveal a missing file, without a project, and reports a file manager that fails', async () => {
    const withoutProject = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    const noProject = await projectDataRpcHandlersCreate(withoutProject).projectDataFileReveal({
      kind: 'prefabs',
      name: 'a.json',
    });
    expect(noProject.ok).toBe(false);
    const { host } = await projectOpen();
    const failing = projectDataRpcHandlersCreate(host, new ProjectDataFileStore(), async () => {
      throw new Error('no file manager');
    });
    expect((await failing.projectDataFileReveal({ kind: 'prefabs', name: 'missing.json' })).ok).toBe(false);
    failing.projectDataFileWrite({ kind: 'prefabs', name: 'there.json', text: '{}' });
    const result = await failing.projectDataFileReveal({ kind: 'prefabs', name: 'there.json' });
    expect(result.ok ? '' : result.message).toContain('no file manager');
  });
});
