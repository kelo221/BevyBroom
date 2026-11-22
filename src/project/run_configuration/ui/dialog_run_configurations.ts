import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationEditorModel } from '@/project/run_configuration/ui/run_configuration_editor_model.js';
import { runConfigurationDialogConfigurationColumnCreate } from '@/project/run_configuration/ui/run_configuration_dialog_configuration_column.js';
import { runConfigurationDialogStepColumnCreate } from '@/project/run_configuration/ui/run_configuration_dialog_step_column.js';
import { DialogModalChoice } from '@/ui/dialog/dialog_modal_choice.js';

/** Smallest width of the dialog in pixels. */
const DIALOG_RUN_CONFIGURATIONS_MIN_WIDTH_PX = 620;

/** Largest width of the dialog in pixels. */
const DIALOG_RUN_CONFIGURATIONS_MAX_WIDTH_PX = 760;

/** Configurations and active pick the user saved. */
export interface DialogRunConfigurationsAnswer {
  /** Configurations in order. */
  readonly configurations: RunConfiguration[];
  /** Configuration F9 runs, or null for none. */
  readonly activeId: string | null;
}

/** What the dialog opens with. */
export interface DialogRunConfigurationsOptions {
  /** Element that owns the modal overlay. */
  readonly host: HTMLElement;
  /** Configurations to edit. */
  readonly configurations: readonly RunConfiguration[];
  /** Configuration F9 runs now, or null. */
  readonly activeId: string | null;
}

/**
 * Shows the Run Configurations dialog.
 *
 * @param options Host element, configurations and active pick.
 * @returns The saved configurations and pick, or null when cancelled.
 */
export function showRunConfigurationsDialog(
  options: DialogRunConfigurationsOptions,
): Promise<DialogRunConfigurationsAnswer | null> {
  return new Promise((resolve) => {
    const dialog = new DialogRunConfigurations(options, (answer) => {
      resolve(answer);
      queueMicrotask(() => dialog.dispose());
    });
    dialog.show();
  });
}

/**
 * Modal dialog that edits run configurations: the list on the left, the
 * selected configuration's name, steps and step fields on the right. Save hands
 * the edited copy back; Cancel drops it.
 */
export class DialogRunConfigurations extends DialogModalChoice {
  private readonly model: RunConfigurationEditorModel;
  private readonly body: HTMLElement;

  /**
   * Creates the dialog.
   *
   * @param options Host element, configurations and active pick.
   * @param settle Receives the saved answer, or null when cancelled.
   */
  constructor(options: DialogRunConfigurationsOptions, settle: (answer: DialogRunConfigurationsAnswer | null) => void) {
    const model = new RunConfigurationEditorModel(options.configurations, options.activeId);
    super(
      {
        host: options.host,
        title: 'Run Configurations',
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
        minWidthPx: DIALOG_RUN_CONFIGURATIONS_MIN_WIDTH_PX,
        maxWidthPx: DIALOG_RUN_CONFIGURATIONS_MAX_WIDTH_PX,
      },
      (confirmed) => settle(confirmed ? DialogRunConfigurations.answerCreate(model) : null),
    );
    this.model = model;
    this.body = document.createElement('div');
    this.dialogBuild();
  }

  /**
   * Builds the two-column body.
   *
   * @returns Body element.
   */
  protected bodyCreate(): HTMLElement {
    this.body.style.display = 'grid';
    this.body.style.gridTemplateColumns = '1fr 2fr';
    this.body.style.gap = '12px';
    this.body.style.margin = '0 0 14px';
    this.bodyRefresh();
    return this.body;
  }

  /**
   * Returns the configuration list, focused when the dialog opens.
   *
   * @returns List box, or null.
   */
  protected override focusTargetRead(): HTMLElement | null {
    return this.body.querySelector('select');
  }

  /**
   * Refuses saving while a text field or text area has focus, so Enter in a
   * field never saves an edit the field has not handed over yet.
   *
   * @returns True when no text field has focus.
   */
  protected override isConfirmAllowed(): boolean {
    const focused = document.activeElement;
    return !(focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement);
  }

  /** Rebuilds both columns from the working copy. */
  private bodyRefresh(): void {
    const refresh = () => this.bodyRefresh();
    this.body.replaceChildren(
      runConfigurationDialogConfigurationColumnCreate(this.model, refresh),
      runConfigurationDialogStepColumnCreate(this.model, refresh),
    );
  }

  /**
   * Creates the answer from the working copy.
   *
   * @param model Working copy.
   * @returns Configurations and active pick.
   */
  private static answerCreate(model: RunConfigurationEditorModel): DialogRunConfigurationsAnswer {
    return { configurations: [...model.configurationsRead()], activeId: model.activeIdRead() };
  }
}
