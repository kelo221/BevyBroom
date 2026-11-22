import type { RunConfigurationStepKind } from '@/project/run_configuration/steps/run_configuration_step_kind.js';
import { RunConfigurationStepKindLevelSave } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_level_save.js';
import { RunConfigurationStepKindLevelPackageBuild } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_level_package_build.js';
import { RunConfigurationStepKindGamePlay } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_game_play.js';
import { RunConfigurationStepKindGameStop } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_game_stop.js';
import { RunConfigurationStepKindCommand } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_command.js';

/** Step kinds run configurations can use, in the order the dialog offers them. */
const RUN_CONFIGURATION_STEP_KINDS: RunConfigurationStepKind[] = [
  new RunConfigurationStepKindLevelSave(),
  new RunConfigurationStepKindLevelPackageBuild(),
  new RunConfigurationStepKindCommand(),
  new RunConfigurationStepKindGamePlay(),
  new RunConfigurationStepKindGameStop(),
];

/** Lists, finds and registers the step kinds of run configurations. */
export class RunConfigurationStepKindRegistry {
  /**
   * Lists every step kind in dialog order.
   *
   * @returns Step kinds.
   */
  static list(): readonly RunConfigurationStepKind[] {
    return RUN_CONFIGURATION_STEP_KINDS;
  }

  /**
   * Finds a step kind by id.
   *
   * @param id Step kind identifier.
   * @returns The kind, or null when no kind has the id.
   */
  static find(id: string): RunConfigurationStepKind | null {
    return RUN_CONFIGURATION_STEP_KINDS.find((kind) => kind.id === id) ?? null;
  }

  /**
   * Adds a step kind, replacing a kind with the same id.
   *
   * @param kind Step kind to add.
   */
  static register(kind: RunConfigurationStepKind): void {
    const index = RUN_CONFIGURATION_STEP_KINDS.findIndex((existing) => existing.id === kind.id);
    if (index >= 0) {
      RUN_CONFIGURATION_STEP_KINDS[index] = kind;
      return;
    }
    RUN_CONFIGURATION_STEP_KINDS.push(kind);
  }
}
