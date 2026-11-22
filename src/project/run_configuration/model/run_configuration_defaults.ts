import type { ProjectSummary } from '@/project/process/game_process_types.js';
import type {
  RunConfiguration,
  RunConfigurationStep,
} from '@/project/run_configuration/model/run_configuration_types.js';
import { RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_level_save.js';
import { RUN_CONFIGURATION_STEP_KIND_LEVEL_PACKAGE_BUILD } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_level_package_build.js';
import { RUN_CONFIGURATION_STEP_KIND_GAME_PLAY } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_game_play.js';

/** Identifier of the configuration a project without run configurations gets. */
export const RUN_CONFIGURATION_DEFAULT_PLAY_ID = 'play';

/**
 * Creates the configurations of a project that stores none: one "Play" that
 * saves the open level when the game starts in it, builds its package when the
 * game reads the package, and starts the game.
 *
 * @param project Open project.
 * @returns The default configurations.
 */
export function runConfigurationDefaultsCreate(project: ProjectSummary): RunConfiguration[] {
  const steps: RunConfigurationStep[] = [];
  if (project.isLevelLaunch) {
    steps.push(runConfigurationDefaultStepCreate(RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE));
  }
  if (project.isLevelExportLaunch) {
    steps.push(runConfigurationDefaultStepCreate(RUN_CONFIGURATION_STEP_KIND_LEVEL_PACKAGE_BUILD));
  }
  steps.push(runConfigurationDefaultStepCreate(RUN_CONFIGURATION_STEP_KIND_GAME_PLAY));
  return [{ id: RUN_CONFIGURATION_DEFAULT_PLAY_ID, name: 'Play', steps }];
}

/**
 * Creates an enabled step without fields.
 *
 * @param kind Step kind identifier.
 * @returns New step.
 */
function runConfigurationDefaultStepCreate(kind: string): RunConfigurationStep {
  return { kind, enabled: true, fields: {} };
}
