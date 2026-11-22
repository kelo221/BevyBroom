import type { GameProcessStatus } from '@/project/process/game_process_types.js';
import type { RunConfigurationCommandSection } from '@/project/run_configuration/model/run_configuration_types.js';
import type { RunConfigurationRunContext } from '@/project/run_configuration/steps/run_configuration_step_kind.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';

/** Milliseconds between two status reads while a step waits for the desktop app. */
export const RUN_CONFIGURATION_RUN_CONTEXT_POLL_MILLISECONDS = 250;

/** Why level steps cannot run without an open project level. */
export const RUN_CONFIGURATION_NO_PROJECT_LEVEL_REFUSAL = 'Open or save a level of the open project first.';

/**
 * Does what run configuration steps ask for through the project workbench and
 * waits for the desktop app until each piece of work ended.
 */
export class RunConfigurationRunContextWorkbench implements RunConfigurationRunContext {
  private readonly workbench: ProjectWorkbench;
  private readonly pollMilliseconds: number;

  /**
   * Creates the context.
   *
   * @param workbench Workbench of the open project.
   * @param pollMilliseconds Wait between two status reads.
   */
  constructor(workbench: ProjectWorkbench, pollMilliseconds = RUN_CONFIGURATION_RUN_CONTEXT_POLL_MILLISECONDS) {
    this.workbench = workbench;
    this.pollMilliseconds = pollMilliseconds;
  }

  /**
   * Saves the open level.
   *
   * @returns Null when it was saved, or why not.
   */
  levelSave(): Promise<string | null> {
    return this.workbench.openLevelSave();
  }

  /**
   * Builds the package of the open project level.
   *
   * @returns Null when it was built, or why not.
   */
  async levelPackageBuild(): Promise<string | null> {
    const level = this.workbench.openProjectLevelRead();
    if (level === null) {
      return RUN_CONFIGURATION_NO_PROJECT_LEVEL_REFUSAL;
    }
    const result = await this.workbench.levelBuild(level.id);
    return result.ok ? null : result.message;
  }

  /**
   * Starts the game, or builds and starts it again, and waits until it runs.
   *
   * @returns Null when the game runs, or why it does not.
   */
  async gamePlay(): Promise<string | null> {
    await this.workbench.actionStartWithoutPrepare(this.workbench.levelPlayActionResolve());
    const status = await this.idleWait();
    return status.phase === 'running' ? null : status.message;
  }

  /**
   * Stops the game and waits until it ended.
   *
   * @returns Always null; a game that was not running counts as stopped.
   */
  async gameStop(): Promise<string | null> {
    await this.workbench.actionStartWithoutPrepare('stop');
    await this.idleWait();
    return null;
  }

  /**
   * Runs a command in the desktop app and waits until it ended.
   *
   * @param command Program, arguments and folder.
   * @returns Null when it exited with code 0, or why it failed.
   */
  async commandRun(command: RunConfigurationCommandSection): Promise<string | null> {
    const started = await this.workbench.commandStart(command);
    const identifier = started.identifier;
    if (identifier === null) {
      return started.status.message;
    }
    const status = await this.statusWait((candidate) =>
      RunConfigurationRunContextWorkbench.commandEnded(candidate, identifier),
    );
    return status.command?.state === 'succeeded' ? null : status.message;
  }

  /**
   * Returns whether a status shows a command ended.
   *
   * @param status Status read.
   * @param identifier Identifier of the command.
   * @returns True once the command succeeded or failed.
   */
  private static commandEnded(status: GameProcessStatus, identifier: number): boolean {
    const command = status.command;
    if (command === null || command.identifier !== identifier) {
      return false;
    }
    return command.state === 'succeeded' || command.state === 'failed';
  }

  /**
   * Waits until the desktop app has nothing scheduled.
   *
   * @returns Status once idle.
   */
  private idleWait(): Promise<GameProcessStatus> {
    return this.statusWait((status) => !status.isBusy);
  }

  /**
   * Reads the status until it passes a test.
   *
   * @param isDone Test the status must pass.
   * @returns The first status that passed.
   */
  private async statusWait(isDone: (status: GameProcessStatus) => boolean): Promise<GameProcessStatus> {
    for (;;) {
      const status = await this.workbench.statusRefresh();
      if (isDone(status)) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollMilliseconds));
    }
  }
}
