import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { gameProcessRpcHandlersCreate } from '@/desktop/bun/game_process/game_process_rpc_handlers.js';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  LEVEL_BUILD_MANIFEST_VERSION,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import type { LevelBuildPublishRequest } from '@/level_build/publish/level_build_publish_types.js';
import { GameProcessSpawnerFake } from './game_process_spawner_fake.js';

/** Level directory of the temporary project, relative to its asset root. */
const RPC_TEST_LEVEL_DIRECTORY = 'broom/levels';

/** Temporary project directories created by the running test. */
const projectDirectories: string[] = [];

/**
 * Writes a project file into a fresh temporary directory.
 *
 * @returns Absolute project file path.
 */
function projectFileCreate(): string {
  const directory = mkdtempSync(join(tmpdir(), 'broom-rpc-project-'));
  projectDirectories.push(directory);
  const project = {
    project_version: 1,
    project_id: 'rpc-project',
    asset_root: 'assets',
    material_catalog: 'broom/materials.json',
    level_directory: RPC_TEST_LEVEL_DIRECTORY,
    preview: { program: 'cargo', arguments: ['run'], endpoint: 'http://127.0.0.1:15999' },
  };
  const projectFile = join(directory, 'broom.project.json');
  writeFileSync(projectFile, JSON.stringify(project));
  return projectFile;
}

/**
 * Creates a request publishing a tiny geometry under a level name.
 *
 * @param levelName Raw level name.
 * @returns Publish request.
 */
function requestCreate(levelName: string): LevelBuildPublishRequest {
  const manifest: LevelBuildManifest = {
    manifest_version: LEVEL_BUILD_MANIFEST_VERSION,
    protocol: 4,
    level_name: levelName,
    geometry_file: '',
    geometry_revision: 0,
    state: {
      protocol: 4,
      project_id: 'rpc-project',
      document_id: 'd',
      session_id: 'build',
      revision: 1,
      geometry_revision: 0,
      objects: [],
    },
    materials: [],
  };
  return { levelName, glbBase64: Buffer.from('glb').toString('base64'), manifest };
}

/**
 * Creates the request handlers over a host with the real file system.
 *
 * @returns Handlers and host.
 */
function handlersCreate(): { handlers: ReturnType<typeof gameProcessRpcHandlersCreate>; host: GameProcessHost } {
  const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
  return { handlers: gameProcessRpcHandlersCreate(host, async () => []), host };
}

afterEach(() => {
  projectDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

/** Unit tests for the desktop requests that publish level packages. */
describe('gameProcessRpcHandlersCreate levelPackagePublish', () => {
  it('refuses to publish without an open project', () => {
    const { handlers } = handlersCreate();
    expect(handlers.levelPackagePublish(requestCreate('hall')).ok).toBe(false);
  });

  it("writes the package into the open project's level directory under the sanitized name", async () => {
    const { handlers, host } = handlersCreate();
    const projectFile = projectFileCreate();
    expect((await host.projectOpen(projectFile)).ok).toBe(true);
    const result = handlers.levelPackagePublish(requestCreate('Great Hall'));
    if (!result.ok) {
      throw new Error(result.message);
    }
    const definition = host.projectDefinitionRead();
    expect(result.levelDirectory).toBe(`${definition?.levelDirectory}/great_hall`);
    const manifest = JSON.parse(readFileSync(`${result.levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`, 'utf8'));
    expect(manifest).toMatchObject({
      geometry_file: result.geometryFile,
      manifest_version: LEVEL_BUILD_MANIFEST_VERSION,
    });
  });
});
