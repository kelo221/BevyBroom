import {
  RunConfigurationStepKind,
  type RunConfigurationRunContext,
} from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Identifier of the step that builds the open level's package. */
export const RUN_CONFIGURATION_STEP_KIND_LEVEL_PACKAGE_BUILD = 'level_package_build';

/**
 * Step that builds the open level's package (geometry and collision) into the
 * project.
 */
export class RunConfigurationStepKindLevelPackageBuild extends RunConfigurationStepKind {
  readonly id = RUN_CONFIGURATION_STEP_KIND_LEVEL_PACKAGE_BUILD;
  readonly label = 'Build Level';

  /**
   * Builds the open level's package.
   *
   * @param _step Step to run; it has no fields.
   * @param context What the step may ask for.
   * @returns Null on success, or the reason it failed.
   */
  run(_step: unknown, context: RunConfigurationRunContext): Promise<string | null> {
    return context.levelPackageBuild();
  }
}
