import { describe, expect, it } from 'vitest';
import type {
  RunConfiguration,
  RunConfigurationCommandSection,
} from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationRunner } from '@/project/run_configuration/run/run_configuration_runner.js';
import type { RunConfigurationRunState } from '@/project/run_configuration/run/run_configuration_run_state.js';
import type { RunConfigurationRunContext } from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Context double that records what steps asked for and fails on request. */
class RunContextRecorder implements RunConfigurationRunContext {
  readonly calls: string[] = [];
  readonly commands: RunConfigurationCommandSection[] = [];
  readonly failures = new Map<string, string>();

  /**
   * Records a call and answers with its scripted failure.
   *
   * @param name Call name.
   * @returns Scripted failure or null.
   */
  private answer(name: string): Promise<string | null> {
    this.calls.push(name);
    return Promise.resolve(this.failures.get(name) ?? null);
  }

  /**
   * Records a level save.
   *
   * @returns Scripted failure or null.
   */
  levelSave(): Promise<string | null> {
    return this.answer('levelSave');
  }

  /**
   * Records a level package build.
   *
   * @returns Scripted failure or null.
   */
  levelPackageBuild(): Promise<string | null> {
    return this.answer('levelPackageBuild');
  }

  /**
   * Records a game start.
   *
   * @returns Scripted failure or null.
   */
  gamePlay(): Promise<string | null> {
    return this.answer('gamePlay');
  }

  /**
   * Records a game stop.
   *
   * @returns Scripted failure or null.
   */
  gameStop(): Promise<string | null> {
    return this.answer('gameStop');
  }

  /**
   * Records a command.
   *
   * @param command Command asked for.
   * @returns Scripted failure or null.
   */
  commandRun(command: RunConfigurationCommandSection): Promise<string | null> {
    this.commands.push(command);
    return this.answer('commandRun');
  }
}

/** Configuration with every built-in step, one of them skipped. */
const RUNNER_TEST_CONFIGURATION: RunConfiguration = {
  id: 'bake_play',
  name: 'Bake and Play',
  steps: [
    { kind: 'level_save', enabled: true, fields: {} },
    { kind: 'level_package_build', enabled: true, fields: {} },
    { kind: 'game_stop', enabled: false, fields: {} },
    { kind: 'command', enabled: true, fields: { program: 'cargo', arguments: ['run', '--bake-level', '{level_id}'] } },
    { kind: 'game_play', enabled: true, fields: {} },
  ],
};

/**
 * The runner runs the enabled steps in order, hands command fields to the
 * context, stops at the first failure and reports every state change.
 */
describe('RunConfigurationRunner', () => {
  it('runs the enabled steps in order and finishes', async () => {
    const context = new RunContextRecorder();
    const states: RunConfigurationRunState[] = [];
    const final = await new RunConfigurationRunner(context, (state) => states.push(state)).run(
      RUNNER_TEST_CONFIGURATION,
    );
    expect(context.calls).toEqual(['levelSave', 'levelPackageBuild', 'commandRun', 'gamePlay']);
    expect(context.commands).toEqual([
      { program: 'cargo', arguments: ['run', '--bake-level', '{level_id}'], working_directory: '.' },
    ]);
    expect(final.phase).toBe('succeeded');
    expect(states.filter((state) => state.phase === 'running')).toHaveLength(context.calls.length);
  });

  it('stops at the first failing step and names it', async () => {
    const context = new RunContextRecorder();
    context.failures.set('commandRun', 'exit code 3');
    const final = await new RunConfigurationRunner(context, () => undefined).run(RUNNER_TEST_CONFIGURATION);
    expect(context.calls).toEqual(['levelSave', 'levelPackageBuild', 'commandRun']);
    expect(final).toMatchObject({ phase: 'failed', stepIndex: 2 });
    expect(final.message).toContain('exit code 3');
  });

  it('fails on a step of an unknown kind without running later steps', async () => {
    const context = new RunContextRecorder();
    const configuration = { ...RUNNER_TEST_CONFIGURATION, steps: [{ kind: 'teleport', enabled: true, fields: {} }] };
    const final = await new RunConfigurationRunner(context, () => undefined).run(configuration);
    expect(final.phase).toBe('failed');
    expect(final.message).toContain('teleport');
    expect(context.calls).toEqual([]);
  });

  it('refuses a second run while one is going on and keeps the first run state', async () => {
    const context = new RunContextRecorder();
    const runner = new RunConfigurationRunner(context, () => undefined);
    const first = runner.run(RUNNER_TEST_CONFIGURATION);
    const second = await runner.run(RUNNER_TEST_CONFIGURATION);
    expect(second.phase).toBe('failed');
    expect(runner.stateRead()?.phase).toBe('running');
    expect((await first).phase).toBe('succeeded');
  });
});
