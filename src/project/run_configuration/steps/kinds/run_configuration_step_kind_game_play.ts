import {
  RunConfigurationStepKind,
  type RunConfigurationRunContext,
} from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Identifier of the step that starts the game. */
export const RUN_CONFIGURATION_STEP_KIND_GAME_PLAY = 'game_play';

/**
 * Step that starts the game in the open level with the project's preview
 * command, or builds and starts it again when it already runs.
 */
export class RunConfigurationStepKindGamePlay extends RunConfigurationStepKind {
  readonly id = RUN_CONFIGURATION_STEP_KIND_GAME_PLAY;
  readonly label = 'Start Game';

  /**
   * Starts the game and waits until it runs or failed to start.
   *
   * @param _step Step to run; it has no fields.
   * @param context What the step may ask for.
   * @returns Null on success, or the reason it failed.
   */
  run(_step: unknown, context: RunConfigurationRunContext): Promise<string | null> {
    return context.gamePlay();
  }
}
