import {
  RunConfigurationStepKind,
  type RunConfigurationRunContext,
} from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Identifier of the step that saves the open level. */
export const RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE = 'level_save';

/** Step that saves the open level. */
export class RunConfigurationStepKindLevelSave extends RunConfigurationStepKind {
  readonly id = RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE;
  readonly label = 'Save Level';

  /**
   * Saves the open level.
   *
   * @param _step Step to run; it has no fields.
   * @param context What the step may ask for.
   * @returns Null on success, or the reason it failed.
   */
  run(_step: unknown, context: RunConfigurationRunContext): Promise<string | null> {
    return context.levelSave();
  }
}
