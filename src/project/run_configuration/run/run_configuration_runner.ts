import type {
  RunConfiguration,
  RunConfigurationStep,
} from '@/project/run_configuration/model/run_configuration_types.js';
import type { RunConfigurationRunContext } from '@/project/run_configuration/steps/run_configuration_step_kind.js';
import { RunConfigurationStepKindRegistry } from '@/project/run_configuration/steps/run_configuration_step_kind_registry.js';
import type { RunConfigurationRunState } from '@/project/run_configuration/run/run_configuration_run_state.js';

/** Receives every change of a run's state. */
export type RunConfigurationRunListener = (state: RunConfigurationRunState) => void;

/**
 * Runs the enabled steps of a run configuration one after another and stops at
 * the first step that fails. Only one run happens at a time.
 */
export class RunConfigurationRunner {
  private readonly context: RunConfigurationRunContext;
  private readonly listener: RunConfigurationRunListener;
  private state: RunConfigurationRunState | null = null;

  /**
   * Creates the runner.
   *
   * @param context What steps may ask for.
   * @param listener Receives every change of the run state.
   */
  constructor(context: RunConfigurationRunContext, listener: RunConfigurationRunListener) {
    this.context = context;
    this.listener = listener;
  }

  /**
   * Returns the state of the last run.
   *
   * @returns State, or null before the first run.
   */
  stateRead(): RunConfigurationRunState | null {
    return this.state;
  }

  /**
   * Returns whether a run is going on.
   *
   * @returns True while a run has not ended.
   */
  isRunning(): boolean {
    return this.state?.phase === 'running';
  }

  /**
   * Runs a configuration to its end.
   *
   * @param configuration Configuration to run.
   * @returns Final state of the run.
   */
  async run(configuration: RunConfiguration): Promise<RunConfigurationRunState> {
    if (this.isRunning()) {
      return RunConfigurationRunner.busyStateCreate(configuration);
    }
    const steps = configuration.steps.filter((step) => step.enabled);
    for (const [stepIndex, step] of steps.entries()) {
      const failure = await this.stepRun(configuration, step, stepIndex);
      if (failure !== null) {
        return this.stateWrite(configuration, 'failed', stepIndex, failure);
      }
    }
    return this.stateWrite(configuration, 'succeeded', steps.length, `${configuration.name} finished.`);
  }

  /**
   * Creates the state of a run refused because another run is going on; it is
   * neither stored nor announced, so the ongoing run keeps its state.
   *
   * @param configuration Configuration that was asked for.
   * @returns Failed state.
   */
  private static busyStateCreate(configuration: RunConfiguration): RunConfigurationRunState {
    return {
      configurationId: configuration.id,
      configurationName: configuration.name,
      phase: 'failed',
      stepIndex: 0,
      message: 'Another run configuration is still running.',
    };
  }

  /**
   * Runs one step and reports that it started.
   *
   * @param configuration Configuration the step belongs to.
   * @param step Step to run.
   * @param stepIndex Position among the enabled steps.
   * @returns Null on success, or the reason it failed.
   */
  private async stepRun(
    configuration: RunConfiguration,
    step: RunConfigurationStep,
    stepIndex: number,
  ): Promise<string | null> {
    const kind = RunConfigurationStepKindRegistry.find(step.kind);
    if (kind === null) {
      return `Step ${stepIndex + 1} has the unknown kind "${step.kind}".`;
    }
    this.stateWrite(configuration, 'running', stepIndex, `${configuration.name}: ${kind.summaryDescribe(step)}`);
    try {
      const failure = await kind.run(step, this.context);
      return failure === null ? null : `${kind.label} failed: ${failure}`;
    } catch (error) {
      return `${kind.label} failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Stores and announces the run state.
   *
   * @param configuration Configuration being run.
   * @param phase Where the run is.
   * @param stepIndex Position of the current step.
   * @param message What happened.
   * @returns The new state.
   */
  private stateWrite(
    configuration: RunConfiguration,
    phase: RunConfigurationRunState['phase'],
    stepIndex: number,
    message: string,
  ): RunConfigurationRunState {
    const state = {
      configurationId: configuration.id,
      configurationName: configuration.name,
      phase,
      stepIndex,
      message,
    };
    this.state = state;
    this.listener(state);
    return state;
  }
}
