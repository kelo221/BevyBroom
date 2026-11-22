import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { runConfigurationDefaultsCreate } from '@/project/run_configuration/model/run_configuration_defaults.js';
import type {
  RunConfiguration,
  RunConfigurationsWriteResult,
} from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationRunContextWorkbench } from '@/project/run_configuration/run/run_configuration_run_context_workbench.js';
import type { RunConfigurationRunState } from '@/project/run_configuration/run/run_configuration_run_state.js';
import { RunConfigurationRunner } from '@/project/run_configuration/run/run_configuration_runner.js';
import type { RunConfigurationRunContext } from '@/project/run_configuration/steps/run_configuration_step_kind.js';
import { RunConfigurationActiveStore } from '@/project/run_configuration/service/run_configuration_active_store.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';

/** Why nothing runs without an open project. */
export const PROJECT_RUN_CONFIGURATIONS_NO_PROJECT_MESSAGE = 'Open a game project first.';

/** Parts the run configurations of a project work with. */
export interface ProjectRunConfigurationsHosts {
  /** Workbench of the open project. */
  readonly workbench: ProjectWorkbench;
  /** Remembers the active configuration on this computer. */
  readonly activeStore?: RunConfigurationActiveStore;
  /** What steps ask for; the workbench by default. */
  readonly context?: RunConfigurationRunContext;
  /** Console the runs report to; the shared console by default. */
  readonly consoleResolve?: () => ConsoleLog;
}

/**
 * The run configurations of the open project: the ones its file stores, or a
 * default "Play" when it stores none. It knows which one is active, runs them
 * and stores edits back into the project file.
 */
export class ProjectRunConfigurations {
  private readonly workbench: ProjectWorkbench;
  private readonly activeStore: RunConfigurationActiveStore;
  private readonly runner: RunConfigurationRunner;
  private readonly consoleResolve: () => ConsoleLog;

  /**
   * Creates the run configurations of a workbench.
   *
   * @param hosts Workbench, active store, step context and console.
   */
  constructor(hosts: ProjectRunConfigurationsHosts) {
    this.workbench = hosts.workbench;
    this.activeStore = hosts.activeStore ?? new RunConfigurationActiveStore();
    this.consoleResolve = hosts.consoleResolve ?? (() => ConsoleLog.shared());
    const context = hosts.context ?? new RunConfigurationRunContextWorkbench(hosts.workbench);
    this.runner = new RunConfigurationRunner(context, (state) => this.stateReport(state));
  }

  /**
   * Lists the configurations of the open project.
   *
   * @returns Stored configurations, the default ones when none are stored, or
   *   none without a project.
   */
  listRead(): RunConfiguration[] {
    const project = this.workbench.statusRead()?.project ?? null;
    if (project === null) {
      return [];
    }
    return project.runConfigurations.length > 0 ? project.runConfigurations : runConfigurationDefaultsCreate(project);
  }

  /**
   * Returns whether the project file stores its own configurations.
   *
   * @returns False when the default ones are shown.
   */
  isStoredInProject(): boolean {
    return (this.workbench.statusRead()?.project?.runConfigurations.length ?? 0) > 0;
  }

  /**
   * Returns the configuration F9 runs.
   *
   * @returns The picked configuration, the first one when the pick is gone, or
   *   null without configurations.
   */
  activeRead(): RunConfiguration | null {
    const configurations = this.listRead();
    const projectFile = this.workbench.statusRead()?.project?.projectFile ?? '';
    const activeId = this.activeStore.activeRead(projectFile);
    return configurations.find((configuration) => configuration.id === activeId) ?? configurations[0] ?? null;
  }

  /**
   * Picks the configuration F9 runs.
   *
   * @param configurationId Configuration id.
   */
  activeWrite(configurationId: string): void {
    const projectFile = this.workbench.statusRead()?.project?.projectFile ?? null;
    if (projectFile !== null) {
      this.activeStore.activeWrite(projectFile, configurationId);
    }
  }

  /**
   * Runs the active configuration.
   *
   * @returns Final state of the run.
   */
  runActive(): Promise<RunConfigurationRunState> {
    return this.run(this.activeRead()?.id ?? '');
  }

  /**
   * Runs one configuration to its end.
   *
   * @param configurationId Configuration id.
   * @returns Final state of the run.
   */
  async run(configurationId: string): Promise<RunConfigurationRunState> {
    const configuration = this.listRead().find((candidate) => candidate.id === configurationId) ?? null;
    if (configuration === null) {
      return this.missingStateReport(configurationId);
    }
    return this.runner.run(configuration);
  }

  /**
   * Returns the state of the last run.
   *
   * @returns State, or null before the first run.
   */
  runStateRead(): RunConfigurationRunState | null {
    return this.runner.stateRead();
  }

  /**
   * Stores configurations in the project file and keeps the active pick when it
   * still exists.
   *
   * @param configurations Configurations to store.
   * @returns The stored configurations, or why they were not stored.
   */
  listWrite(configurations: RunConfiguration[]): Promise<RunConfigurationsWriteResult> {
    return this.workbench.runConfigurationsWrite(configurations);
  }

  /**
   * Reports a run that could not find its configuration.
   *
   * @param configurationId Configuration id asked for.
   * @returns Failed state.
   */
  private missingStateReport(configurationId: string): RunConfigurationRunState {
    const hasProject = this.workbench.statusRead()?.project != null;
    const message = hasProject
      ? `The project has no run configuration "${configurationId}".`
      : PROJECT_RUN_CONFIGURATIONS_NO_PROJECT_MESSAGE;
    const state = {
      configurationId,
      configurationName: configurationId,
      phase: 'failed' as const,
      stepIndex: 0,
      message,
    };
    this.stateReport(state);
    return state;
  }

  /**
   * Writes a run state change into the console.
   *
   * @param state New state.
   */
  private stateReport(state: RunConfigurationRunState): void {
    const consoleLog = this.consoleResolve();
    if (state.phase === 'failed') {
      consoleLog.entryAppendError(`Run: ${state.message}`);
      return;
    }
    consoleLog.entryAppendInfo(`Run: ${state.message}`);
  }
}
