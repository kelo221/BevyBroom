import type { RunConfigurationStep } from '@/project/run_configuration/model/run_configuration_types.js';
import type { RunConfigurationEditorModel } from '@/project/run_configuration/ui/run_configuration_editor_model.js';
import type { RunConfigurationStepField } from '@/project/run_configuration/steps/run_configuration_step_kind.js';
import { RunConfigurationStepKindRegistry } from '@/project/run_configuration/steps/run_configuration_step_kind_registry.js';
import {
  runConfigurationDialogCaptionCreate,
  runConfigurationDialogTextFieldCreate,
  runConfigurationDialogTextListFieldCreate,
} from '@/project/run_configuration/ui/run_configuration_dialog_controls.js';

/**
 * Builds the editors of the selected step's fields, as its kind describes them.
 *
 * @param model Working copy.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Field editors; empty when the step has no fields.
 */
export function runConfigurationDialogStepFieldsCreate(
  model: RunConfigurationEditorModel,
  refresh: () => void,
): HTMLElement {
  const container = document.createElement('div');
  const step = model.selectedStepRead();
  const fields = step === null ? [] : (RunConfigurationStepKindRegistry.find(step.kind)?.fieldsDescribe() ?? []);
  for (const field of fields) {
    if (step !== null) {
      container.append(
        runConfigurationDialogCaptionCreate(field.label),
        runConfigurationDialogFieldCreate(model, step, field, refresh),
      );
    }
  }
  return container;
}

/**
 * Builds the editor of one field.
 *
 * @param model Working copy.
 * @param step Step holding the field.
 * @param field Field to edit.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Text field or text area.
 */
function runConfigurationDialogFieldCreate(
  model: RunConfigurationEditorModel,
  step: RunConfigurationStep,
  field: RunConfigurationStepField,
  refresh: () => void,
): HTMLElement {
  const value = step.fields[field.key] ?? field.defaultValue;
  const write = (next: string | string[]) => {
    model.stepFieldWrite(field.key, next);
    refresh();
  };
  if (field.type === 'text_list') {
    return runConfigurationDialogTextListFieldCreate(field.label, Array.isArray(value) ? value : [value], write);
  }
  return runConfigurationDialogTextFieldCreate(field.label, Array.isArray(value) ? value.join(' ') : value, write);
}
