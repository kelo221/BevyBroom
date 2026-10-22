import { describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import type { GameProcessProjectReader } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { GameProcessSpawnerFake } from './game_process_spawner_fake.js';

/** Directory of the pretend project. */
const PROJECT_DIRECTORY = '/games/Mein Spiel';

/** Project file of the pretend project. */
const PROJECT_FILE = `${PROJECT_DIRECTORY}/broom.project.json`;

/**
 * Builds a reader holding one project file whose folders all exist.
 *
 * @param projectIdentifier Project id written into the file.
 * @returns Reader.
 */
function readerCreate(projectIdentifier: string): GameProcessProjectReader {
  const project = {
    project_id: projectIdentifier,
    asset_root: 'assets',
    preview: { program: 'cargo', arguments: ['run', '-p', 'game'], endpoint: 'http://127.0.0.1:15999' },
  };
  return {
    textRead: (path) => {
      if (path !== PROJECT_FILE) throw new Error(`${path} not found`);
      return JSON.stringify(project);
    },
    isDirectory: () => true,
    isFile: () => true,
  };
}

/**
 * Builds a host with an opened project.
 *
 * @returns Host and its fake spawner.
 */
async function hostWithProjectCreate(): Promise<{ host: GameProcessHost; spawner: GameProcessSpawnerFake }> {
  const spawner = new GameProcessSpawnerFake();
  const host = new GameProcessHost(spawner, readerCreate('game-a'));
  const opened = await host.projectOpen(PROJECT_FILE);
  if (!opened.ok) throw new Error(opened.message);
  return { host, spawner };
}

/** The host builds, starts, restarts and stops only the games it starts itself. */
describe('GameProcessHost', () => {
  it('reports the opened project with its endpoint and build ability', async () => {
    const { host } = await hostWithProjectCreate();
    const status = host.statusRead();
    expect(status.project).toMatchObject({
      projectIdentifier: 'game-a',
      endpoint: 'http://127.0.0.1:15999',
      canBuild: true,
    });
    expect(status.phase).toBe('idle');
  });

  it('refuses to open a missing project file and to act without a project', async () => {
    const host = new GameProcessHost(new GameProcessSpawnerFake(), readerCreate('game-a'));
    const opened = await host.projectOpen(`${PROJECT_DIRECTORY}/other.json`);
    expect(opened.ok).toBe(false);
    expect(host.actionStart('launch').message).toBe('Open a project first.');
  });

  it('builds before launching and then runs the game', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    const status = await host.idle();
    expect(spawner.runs.map((run) => run.command.arguments[0])).toEqual(['build', 'run']);
    expect(status.phase).toBe('running');
    expect(status.processId).toBe(spawner.runs[1]?.handle.processId);
  });

  it('stops at a failed build and reports its compiler messages', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    spawner.buildExitCode = 101;
    spawner.buildOutput = ['src/main.rs:3:9: error[E0425]: cannot find value `oops` in this scope'];
    host.actionStart('launch');
    const status = await host.idle();
    expect(status.phase).toBe('build_failed');
    expect(status.diagnostics).toEqual([expect.objectContaining({ file: 'src/main.rs', line: 3, column: 9 })]);
    expect(spawner.runningRuns()).toHaveLength(0);
  });

  it('rebuild stops the running game, builds and starts a new one', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    const firstGame = spawner.runs[1];
    host.actionStart('rebuild');
    const status = await host.idle();
    expect(firstGame?.isTerminated).toBe(true);
    expect(spawner.runningRuns()).toHaveLength(1);
    expect(status.phase).toBe('running');
    expect(status.processId).not.toBe(firstGame?.handle.processId);
  });

  it('restart starts a new game without building and stop ends it', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    const runsBefore = spawner.runs.length;
    host.actionStart('restart');
    await host.idle();
    expect(spawner.runs.slice(runsBefore).map((run) => run.command.arguments[0])).toEqual(['run']);
    host.actionStart('stop');
    const stopped = await host.idle();
    expect(stopped.phase).toBe('stopped');
    expect(spawner.runningRuns()).toHaveLength(0);
  });

  it('reports a game that exits on its own and stop then leaves it alone', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    spawner.runs[1]?.exit(3);
    await Promise.resolve();
    await host.idle();
    expect(host.statusRead()).toMatchObject({ phase: 'exited', exitCode: 3, processId: null });
    host.actionStart('stop');
    expect((await host.idle()).phase).toBe('exited');
  });

  it('stops the game of the previous project when another project is opened', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    await host.projectOpen(PROJECT_FILE);
    expect(spawner.runningRuns()).toHaveLength(0);
    expect(host.statusRead().phase).toBe('idle');
  });
});
