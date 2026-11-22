import type { RunConfigurationStep } from '@/project/run_configuration/model/run_configuration_types.js';
import {
  RunConfigurationStepKind,
  type RunConfigurationRunContext,
  type RunConfigurationStepField,
} from '@/project/run_configuration/steps/run_configuration_step_kind.js';

/** Identifier of the step that runs a command. */
export const RUN_CONFIGURATION_STEP_KIND_COMMAND = 'command';

/** Fields of a command step. */
const RUN_CONFIGURATION_STEP_COMMAND_FIELDS: readonly RunConfigurationStepField[] = [
  { key: 'program', label: 'Program', type: 'text', defaultValue: '' },
  { key: 'arguments', label: 'Arguments (one per line)', type: 'text_list', defaultValue: [] },
  { key: 'working_directory', label: 'Folder (relative to the project)', type: 'text', defaultValue: '.' },
];

/**
 * Step that runs a program to its end in the desktop app, such as a light bake
 * or an export script. Arguments may name placeholders such as `{level_id}`,
 * `{level_export_directory}` or `{project_directory}`; a non-zero exit code
 * fails the step.
 */
export class RunConfigurationStepKindCommand extends RunConfigurationStepKind {
  readonly id = RUN_CONFIGURATION_STEP_KIND_COMMAND;
  readonly label = 'Run Command';

  /**
   * Returns the program, arguments and folder fields.
   *
   * @returns Fields in dialog order.
   */
  override fieldsDescribe(): readonly RunConfigurationStepField[] {
    return RUN_CONFIGURATION_STEP_COMMAND_FIELDS;
  }

  /**
   * Describes the step as its command line.
   *
   * @param step Step to describe.
   * @returns Program followed by its arguments.
   */
  override summaryDescribe(step: RunConfigurationStep): string {
    const commandLine = [this.textFieldRead(step, 'program'), ...this.textListFieldRead(step, 'arguments')].join(' ');
    return `${this.label}: ${commandLine.trim()}`;
  }

  /**
   * Runs the command and waits until it ended.
   *
   * @param step Step to run.
   * @param context What the step may ask for.
   * @returns Null when it exited with code 0, or the reason it failed.
   */
  run(step: RunConfigurationStep, context: RunConfigurationRunContext): Promise<string | null> {
    return context.commandRun({
      program: this.textFieldRead(step, 'program'),
      arguments: this.textListFieldRead(step, 'arguments'),
      working_directory: this.textFieldRead(step, 'working_directory') || '.',
    });
  }
}
