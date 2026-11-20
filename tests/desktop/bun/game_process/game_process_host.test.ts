import { describe, expect, it } from 'vitest';
import {
  GAME_PROCESS_NO_LEVEL_REFUSAL,
  GAME_PROCESS_NO_PREVIEW_REFUSAL,
  GameProcessHost,
} from '@/desktop/bun/game_process/game_process_host.js';
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
 * @param hasPreviewSection Whether the file names a program that starts the
 *   game.
 * @param previewArguments Arguments that start the game.
 * @returns Reader.
 */
function readerCreate(
  projectIdentifier: string,
  hasPreviewSection = true,
  previewArguments: string[] = ['run', '-p', 'game'],
): GameProcessProjectReader {
  const preview = { program: 'cargo', arguments: previewArguments, endpoint: 'http://127.0.0.1:15999' };
  const project = {
    project_id: projectIdentifier,
    asset_root: 'assets',
    level_directory: 'broom/levels',
    document_directory: 'broom/documents',
    ...(hasPreviewSection ? { preview } : {}),
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
 * @param previewArguments Arguments that start the game.
 * @returns Host and its fake spawner.
 */
async function hostWithProjectCreate(
  previewArguments?: string[],
): Promise<{ host: GameProcessHost; spawner: GameProcessSpawnerFake }> {
  const spawner = new GameProcessSpawnerFake();
  const host = new GameProcessHost(spawner, readerCreate('game-a', true, previewArguments));
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

  it('opens a project without a preview section and refuses every action that starts its game', async () => {
    const spawner = new GameProcessSpawnerFake();
    const host = new GameProcessHost(spawner, readerCreate('levels-only', false));
    const opened = await host.projectOpen(PROJECT_FILE);
    expect(opened.ok).toBe(true);
    expect(host.statusRead().project).toMatchObject({ canLaunch: false, canBuild: false, endpoint: '', problems: [] });
    for (const action of ['launch', 'rebuild', 'restart'] as const) {
      expect(host.actionStart(action).message).toBe(GAME_PROCESS_NO_PREVIEW_REFUSAL);
    }
    await host.idle();
    expect(spawner.runs).toEqual([]);
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

  /**
   * A running game's `warning:` and `error:` lines become notices the editor
   * shows; cargo's compiler warnings before it hands over to the game do not,
   * and a new start forgets the notices of the previous run.
   */
  it('collects the warnings and errors the running game prints, and forgets them on the next start', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    const game = spawner.runs[1];
    const skippedProp =
      'The store prop shelf names the fixture missing-id, which is not in the catalogue, so it is left out.';
    game?.print('warning: unused variable: `compilerOnly`');
    game?.print('     Running `target/debug/game`');
    game?.print(`warning: ${skippedProp}`);
    game?.print('\u001b[31merror: the save file could not be read\u001b[0m');
    game?.print('an ordinary line');
    expect(host.statusRead().gameNotices).toEqual([
      expect.objectContaining({ severity: 'warning', message: skippedProp }),
      expect.objectContaining({ severity: 'error', message: 'the save file could not be read' }),
    ]);
    host.actionStart('restart');
    await host.idle();
    expect(host.statusRead().gameNotices).toEqual([]);
  });

  it('names the last line a failing game printed, and only the exit code of a game that ends well', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    const reason = 'The level file cannot be played: an object is inside a group.';
    spawner.runs[1]?.print(reason);
    spawner.runs[1]?.print('');
    spawner.runs[1]?.exit(2);
    await host.idle();
    await Promise.resolve();
    expect(host.statusRead().message).toBe(`The game exited with code 2: ${reason}`);
    host.actionStart('restart');
    await host.idle();
    spawner.runs.at(-1)?.print('bye');
    spawner.runs.at(-1)?.exit(0);
    await Promise.resolve();
    await host.idle();
    expect(host.statusRead().message).toBe('The game exited with code 0.');
  });

  it('stops the game of the previous project when another project is opened', async () => {
    const { host, spawner } = await hostWithProjectCreate();
    host.actionStart('launch');
    await host.idle();
    await host.projectOpen(PROJECT_FILE);
    expect(spawner.runningRuns()).toHaveLength(0);
    expect(host.statusRead().phase).toBe('idle');
  });

  /**
   * Level placeholders: a game whose arguments name {level_id},
   * {level_document} or {level_export_directory} starts in the level the editor
   * passes, needs one, and a game without placeholders starts as before.
   */
  describe('level placeholders', () => {
    const levelArguments = [
      'run',
      '--level={level_id}',
      '--document',
      '{level_document}',
      '--export',
      '{level_export_directory}',
    ];

    it('replaces every level placeholder with the values of the passed level', async () => {
      const { host, spawner } = await hostWithProjectCreate(levelArguments);
      expect(host.statusRead().project).toMatchObject({ isLevelLaunch: true, isLevelExportLaunch: true });
      host.actionStart('launch', { levelId: 'Lobby Two', levelDocument: 'areas/lobby two.json' });
      const status = await host.idle();
      expect(status.phase).toBe('running');
      const definition = host.projectDefinitionRead();
      if (!definition) throw new Error('expected an open project');
      expect(spawner.runs.at(-1)?.command.arguments).toEqual([
        'run',
        '--level=lobby_two',
        '--document',
        `${definition.documentDirectory}/areas/lobby two.json`,
        '--export',
        `${definition.levelDirectory}/lobby_two`,
      ]);
    });

    it('refuses to start, rebuild or restart without a level but still stops', async () => {
      const { host, spawner } = await hostWithProjectCreate(levelArguments);
      for (const action of ['launch', 'rebuild', 'restart'] as const) {
        expect(host.actionStart(action).message).toBe(GAME_PROCESS_NO_LEVEL_REFUSAL);
      }
      await host.idle();
      expect(spawner.runs).toEqual([]);
      host.actionStart('launch', { levelId: 'lobby', levelDocument: 'lobby.json' });
      await host.idle();
      host.actionStart('stop');
      expect((await host.idle()).phase).toBe('stopped');
      expect(spawner.runningRuns()).toHaveLength(0);
    });

    it('reports an unknown placeholder as a project error that stops the start', async () => {
      const { host, spawner } = await hostWithProjectCreate(['run', '{level_id}', '{level_name}']);
      const problems = host.statusRead().project?.problems ?? [];
      expect(problems).toEqual([expect.objectContaining({ severity: 'error' })]);
      expect(problems[0]?.message).toContain('{level_name}');
      host.actionStart('launch', { levelId: 'lobby', levelDocument: 'lobby.json' });
      await host.idle();
      expect(spawner.runs).toEqual([]);
    });

    it('starts a game without placeholders exactly as before, ignoring a passed level', async () => {
      const plainArguments = ['run', '-p', 'game'];
      const { host, spawner } = await hostWithProjectCreate(plainArguments);
      expect(host.statusRead().project?.isLevelLaunch).toBe(false);
      host.actionStart('launch', { levelId: 'lobby', levelDocument: 'lobby.json' });
      await host.idle();
      expect(spawner.runs.at(-1)?.command.arguments).toEqual(plainArguments);
    });
  });
});
