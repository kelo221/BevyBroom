import { describe, expect, it } from 'vitest';
import {
  GAME_PROCESS_COMMAND_NO_LEVEL_REFUSAL,
  GameProcessHost,
} from '@/desktop/bun/game_process/game_process_host.js';
import type { GameProcessProjectReader } from '@/desktop/bun/game_process/game_process_project_reader.js';
import type { RunConfigurationProjectFileWriter } from '@/desktop/bun/run_configuration/run_configuration_project_file_writer.js';
import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import { GameProcessSpawnerFake } from './game_process_spawner_fake.js';

/** Folder of the test project. */
const COMMAND_TEST_PROJECT_DIRECTORY = '/games/Command Game';

/** Project file of the test project. */
const COMMAND_TEST_PROJECT_FILE = `${COMMAND_TEST_PROJECT_DIRECTORY}/broom.project.json`;

/** Level the commands run for. */
const COMMAND_TEST_LEVEL = { levelId: 'store', levelDocument: 'store.json' };

/**
 * Creates a reader of a project with a cargo preview command.
 *
 * @returns Reader double.
 */
function readerCreate(): GameProcessProjectReader {
  const project = {
    project_id: 'command-game',
    asset_root: 'assets',
    level_directory: 'levels',
    document_directory: 'levels',
    preview: { program: 'cargo', arguments: ['run'] },
  };
  return { textRead: () => JSON.stringify(project), isDirectory: () => true, isFile: () => true };
}

/** Writer double recording what it was asked to store. */
class RunConfigurationWriterFake {
  readonly writes: { projectFile: string; configurations: readonly RunConfiguration[] }[] = [];

  /**
   * Records a write.
   *
   * @param projectFile Project file.
   * @param configurations Configurations to store.
   */
  write(projectFile: string, configurations: readonly RunConfiguration[]): void {
    this.writes.push({ projectFile, configurations });
  }
}

/**
 * Creates a host with the test project open.
 *
 * @returns Host, spawner and writer.
 */
async function hostCreate(): Promise<{
  host: GameProcessHost;
  spawner: GameProcessSpawnerFake;
  writer: RunConfigurationWriterFake;
}> {
  const spawner = new GameProcessSpawnerFake();
  const writer = new RunConfigurationWriterFake();
  const host = new GameProcessHost(spawner, readerCreate(), writer as unknown as RunConfigurationProjectFileWriter);
  const opened = await host.projectOpen(COMMAND_TEST_PROJECT_FILE);
  if (!opened.ok) throw new Error(opened.message);
  return { host, spawner, writer };
}

/**
 * The desktop host runs the commands run configurations ask for to their end,
 * replaces their placeholders, reports how they ended and stores run
 * configurations in the project file.
 */
describe('GameProcessHost commands', () => {
  it('runs a command to its end with the level and project placeholders replaced', async () => {
    const { host, spawner } = await hostCreate();
    const started = host.commandStart(
      {
        program: 'cargo',
        arguments: ['--bake-level', '{level_id}', '{project_directory}'],
        working_directory: 'tools',
      },
      COMMAND_TEST_LEVEL,
    );
    expect(started.identifier).not.toBeNull();
    expect(started.status.isBusy).toBe(true);
    await Promise.resolve();
    const run = spawner.runs[0];
    expect(run?.command.arguments).toEqual([
      '--bake-level',
      COMMAND_TEST_LEVEL.levelId,
      COMMAND_TEST_PROJECT_DIRECTORY,
    ]);
    expect(run?.command.workingDirectory).toBe(`${COMMAND_TEST_PROJECT_DIRECTORY}/tools`);
    run?.exit(0);
    const status = await host.idle();
    expect(status.isBusy).toBe(false);
    expect(status.command).toEqual({ identifier: started.identifier, state: 'succeeded', exitCode: 0 });
  });

  it('reports a failing command with its exit code and last output line', async () => {
    const { host, spawner } = await hostCreate();
    const started = host.commandStart({ program: 'bake', arguments: [], working_directory: '.' }, null);
    await Promise.resolve();
    spawner.runs[0]?.print('no lights to bake');
    spawner.runs[0]?.exit(4);
    const status = await host.idle();
    expect(status.command).toEqual({ identifier: started.identifier, state: 'failed', exitCode: 4 });
    expect(status.message).toContain('no lights to bake');
  });

  it('refuses a command that names the open level when no level is open', async () => {
    const { host, spawner } = await hostCreate();
    const started = host.commandStart({ program: 'bake', arguments: ['{level_id}'], working_directory: '.' }, null);
    expect(started.identifier).toBeNull();
    expect(started.status.message).toBe(GAME_PROCESS_COMMAND_NO_LEVEL_REFUSAL);
    expect(spawner.runs).toHaveLength(0);
  });

  it('stores run configurations in the project file and reports them in the summary', async () => {
    const { host, writer } = await hostCreate();
    const configurations: RunConfiguration[] = [
      { id: 'bake', name: 'Bake', steps: [{ kind: 'command', enabled: true, fields: { program: 'bake' } }] },
    ];
    const result = host.runConfigurationsWrite(configurations);
    expect(result).toEqual({ ok: true, configurations });
    expect(writer.writes).toEqual([{ projectFile: COMMAND_TEST_PROJECT_FILE, configurations }]);
    expect(host.statusRead().project?.runConfigurations).toEqual(configurations);
  });

  it('refuses run configurations whose ids repeat', async () => {
    const { host, writer } = await hostCreate();
    const configuration: RunConfiguration = { id: 'same', name: 'Same', steps: [] };
    const result = host.runConfigurationsWrite([configuration, { ...configuration, name: 'Other' }]);
    expect(result.ok).toBe(false);
    expect(writer.writes).toHaveLength(0);
  });
});
