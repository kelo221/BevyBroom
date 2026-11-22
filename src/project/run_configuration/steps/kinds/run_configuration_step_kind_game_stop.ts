import {
  RunConfigurationStepKind,
  type RunConfigurationRunContext,
} from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Identifier of the step that stops the game. */
export const RUN_CONFIGURATION_STEP_KIND_GAME_STOP = 'game_stop';

/** Step that stops the game the editor started. */
export class RunConfigurationStepKindGameStop extends RunConfigurationStepKind {
  readonly id = RUN_CONFIGURATION_STEP_KIND_GAME_STOP;
  readonly label = 'Stop Game';

  /**
   * Stops the game and waits until it ended.
   *
   * @param _step Step to run; it has no fields.
   * @param context What the step may ask for.
   * @returns Null on success, or the reason it failed.
   */
  run(_step: unknown, context: RunConfigurationRunContext): Promise<string | null> {
    return context.gameStop();
  }
}
