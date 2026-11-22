import type { RunConfigurationStep } from '@/project/run_configuration/model/run_configuration_types.js';
import type { RunConfigurationEditorModel } from '@/project/run_configuration/ui/run_configuration_editor_model.js';
import { RunConfigurationStepKindRegistry } from '@/project/run_configuration/steps/run_configuration_step_kind_registry.js';
import { GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES } from '@/project/process/launch_level/game_process_launch_placeholders.js';
import { createSettingsSelect } from '@/ui/settings/settings_form_controls.js';
import {
  runConfigurationDialogButtonRowCreate,
  runConfigurationDialogCaptionCreate,
  runConfigurationDialogListCreate,
  runConfigurationDialogTextFieldCreate,
} from '@/project/run_configuration/ui/run_configuration_dialog_controls.js';
import { runConfigurationDialogStepFieldsCreate } from '@/project/run_configuration/ui/run_configuration_dialog_step_fields.js';

/** Mark in front of a skipped step. */
const RUN_CONFIGURATION_DIALOG_SKIPPED_MARK = '(skipped) ';

/**
 * Builds the right column of the Run Configurations dialog for the selected
 * configuration: its name, its steps, the step buttons and the fields of the
 * selected step.
 *
 * @param model Working copy the column edits.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Column element; empty when no configuration is selected.
 */
export function runConfigurationDialogStepColumnCreate(
  model: RunConfigurationEditorModel,
  refresh: () => void,
): HTMLElement {
  const column = document.createElement('div');
  const configuration = model.selectedConfigurationRead();
  if (configuration === null) {
    column.appendChild(runConfigurationDialogCaptionCreate('Add a configuration with New.'));
    return column;
  }
  column.append(
    runConfigurationDialogCaptionCreate('Name'),
    runConfigurationDialogTextFieldCreate('Configuration name', configuration.name, (name) => {
      model.configurationRename(name);
      refresh();
    }),
    runConfigurationDialogCaptionCreate('Steps, run from top to bottom'),
    runConfigurationDialogStepListCreate(model, configuration.steps, refresh),
    runConfigurationDialogStepButtonsCreate(model, refresh),
    runConfigurationDialogStepAddCreate(model, refresh),
    runConfigurationDialogStepFieldsCreate(model, refresh),
    runConfigurationDialogCaptionCreate(runConfigurationDialogPlaceholderHintCreate()),
  );
  return column;
}

/**
 * Builds the list of steps.
 *
 * @param model Working copy.
 * @param steps Steps of the selected configuration.
 * @param refresh Rebuilds the dialog after a change.
 * @returns List box.
 */
function runConfigurationDialogStepListCreate(
  model: RunConfigurationEditorModel,
  steps: readonly RunConfigurationStep[],
  refresh: () => void,
): HTMLSelectElement {
  const rows = steps.map((step, index) => ({
    label: `${index + 1}. ${step.enabled ? '' : RUN_CONFIGURATION_DIALOG_SKIPPED_MARK}${runConfigurationDialogStepSummary(step)}`,
    isDimmed: !step.enabled,
  }));
  return runConfigurationDialogListCreate('Steps', rows, model.selectedStepIndexRead(), (index) => {
    model.stepSelect(index);
    refresh();
  });
}

/**
 * Describes a step in one line.
 *
 * @param step Step to describe.
 * @returns Its kind's summary, or its kind id when the kind is unknown.
 */
function runConfigurationDialogStepSummary(step: RunConfigurationStep): string {
  return RunConfigurationStepKindRegistry.find(step.kind)?.summaryDescribe(step) ?? `Unknown step "${step.kind}"`;
}

/**
 * Builds the buttons that move, skip and remove the selected step.
 *
 * @param model Working copy.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Button row.
 */
function runConfigurationDialogStepButtonsCreate(model: RunConfigurationEditorModel, refresh: () => void): HTMLElement {
  const change = (edit: () => void) => () => {
    edit();
    refresh();
  };
  return runConfigurationDialogButtonRowCreate([
    { label: 'Up', onClick: change(() => model.stepMove(-1)) },
    { label: 'Down', onClick: change(() => model.stepMove(1)) },
    { label: 'Skip / Use', onClick: change(() => model.stepEnabledToggle()) },
    { label: 'Remove Step', onClick: change(() => model.stepRemove()) },
  ]);
}

/**
 * Builds the picker that adds a step of a chosen kind.
 *
 * @param model Working copy.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Picker element.
 */
function runConfigurationDialogStepAddCreate(model: RunConfigurationEditorModel, refresh: () => void): HTMLElement {
  const choices = [
    { value: '', label: 'Add step…' },
    ...RunConfigurationStepKindRegistry.list().map((kind) => ({ value: kind.id, label: kind.label })),
  ];
  const picker = createSettingsSelect(choices, '', (kindId) => {
    model.stepAdd(kindId);
    refresh();
  });
  picker.setAttribute('aria-label', 'Add step');
  picker.style.marginBottom = '8px';
  return picker;
}

/**
 * Lists the placeholders command arguments may name.
 *
 * @returns Hint text.
 */
function runConfigurationDialogPlaceholderHintCreate(): string {
  return `Placeholders: ${GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES.map((name) => `{${name}}`).join(' ')}`;
}
