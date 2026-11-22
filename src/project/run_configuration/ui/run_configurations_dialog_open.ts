import type { ProjectRunConfigurations } from '@/project/run_configuration/service/project_run_configurations.js';
import {
  type DialogRunConfigurationsAnswer,
  type DialogRunConfigurationsOptions,
  showRunConfigurationsDialog,
} from '@/project/run_configuration/ui/dialog_run_configurations.js';
import { showMessageBox } from '@/ui/dialog/dialog_message_box.js';

/** Shows the Run Configurations dialog and resolves with what the user saved. */
export type RunConfigurationsDialogShow = (
  options: DialogRunConfigurationsOptions,
) => Promise<DialogRunConfigurationsAnswer | null>;

/** Tells the user why the configurations were not stored. */
export type RunConfigurationsFailureShow = (message: string) => Promise<unknown>;

/**
 * Opens the Run Configurations dialog for the open project and stores what the
 * user saved in the project file; the active pick stays on this computer.
 *
 * @param runConfigurations Run configurations of the open project.
 * @param dialogShow Shows the dialog; the real dialog by default.
 * @param failureShow Shows a failure; a message box by default.
 * @returns True when the user saved and the project file was written.
 */
export async function runConfigurationsDialogOpen(
  runConfigurations: ProjectRunConfigurations,
  dialogShow: RunConfigurationsDialogShow = showRunConfigurationsDialog,
  failureShow: RunConfigurationsFailureShow = runConfigurationsFailureMessageShow,
): Promise<boolean> {
  const answer = await dialogShow({
    host: document.body,
    configurations: runConfigurations.listRead(),
    activeId: runConfigurations.activeRead()?.id ?? null,
  });
  if (answer === null) {
    return false;
  }
  const result = await runConfigurations.listWrite(answer.configurations);
  if (!result.ok) {
    await failureShow(result.message);
    return false;
  }
  if (answer.activeId !== null) {
    runConfigurations.activeWrite(answer.activeId);
  }
  return true;
}

/**
 * Shows why the configurations were not stored.
 *
 * @param message Reason.
 * @returns Resolves when the user closed the box.
 */
function runConfigurationsFailureMessageShow(message: string): Promise<boolean> {
  return showMessageBox({ host: document.body, title: 'Run Configurations', message, confirmLabel: 'OK' });
}
