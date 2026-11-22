import type { RunConfigurationEditorModel } from '@/project/run_configuration/ui/run_configuration_editor_model.js';
import {
  runConfigurationDialogButtonRowCreate,
  runConfigurationDialogCaptionCreate,
  runConfigurationDialogListCreate,
} from '@/project/run_configuration/ui/run_configuration_dialog_controls.js';

/** Mark in front of the configuration F9 runs. */
const RUN_CONFIGURATION_DIALOG_ACTIVE_MARK = 'F9 ▸ ';

/**
 * Builds the left column of the Run Configurations dialog: the configuration
 * list and the buttons that add, copy, remove and activate configurations.
 *
 * @param model Working copy the column edits.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Column element.
 */
export function runConfigurationDialogConfigurationColumnCreate(
  model: RunConfigurationEditorModel,
  refresh: () => void,
): HTMLElement {
  const column = document.createElement('div');
  const activeId = model.activeIdRead();
  const rows = model.configurationsRead().map((configuration) => ({
    label: `${configuration.id === activeId ? RUN_CONFIGURATION_DIALOG_ACTIVE_MARK : ''}${configuration.name}`,
    isDimmed: false,
  }));
  column.append(
    runConfigurationDialogCaptionCreate('Configurations'),
    runConfigurationDialogListCreate('Run configurations', rows, model.selectedConfigurationIndexRead(), (index) => {
      model.configurationSelect(index);
      refresh();
    }),
    runConfigurationDialogConfigurationButtonsCreate(model, refresh),
  );
  return column;
}

/**
 * Builds the buttons under the configuration list.
 *
 * @param model Working copy the buttons edit.
 * @param refresh Rebuilds the dialog after a change.
 * @returns Button row.
 */
function runConfigurationDialogConfigurationButtonsCreate(
  model: RunConfigurationEditorModel,
  refresh: () => void,
): HTMLElement {
  const change = (edit: () => void) => () => {
    edit();
    refresh();
  };
  return runConfigurationDialogButtonRowCreate([
    { label: 'New', onClick: change(() => model.configurationAdd()) },
    { label: 'Duplicate', onClick: change(() => model.configurationDuplicate()) },
    { label: 'Remove', onClick: change(() => model.configurationRemove()) },
    { label: 'Run on F9', onClick: change(() => model.configurationActivate()) },
  ]);
}
