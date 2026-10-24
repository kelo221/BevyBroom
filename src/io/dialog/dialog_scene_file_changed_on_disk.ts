import { showMessageBox, type MessageBoxOptions } from '@/ui/dialog/dialog_message_box.js';

/**
 * Asks whether Save may overwrite a scene file that another program changed
 * after the editor opened or saved it.
 *
 * @param host Element that owns the dialog.
 * @param fileName Name of the changed file.
 * @param messageBoxShow Shows the question; defaults to the editor's message
 *   box.
 * @returns True when the user chose to overwrite the file.
 */
export function dialogSceneFileChangedOnDiskConfirm(
  host: HTMLElement,
  fileName: string,
  messageBoxShow: (options: MessageBoxOptions) => Promise<boolean> = showMessageBox,
): Promise<boolean> {
  return messageBoxShow({
    host,
    title: 'Scene File Changed',
    message: `${fileName} was changed by another program after it was opened or saved here.\n\nOverwrite it with this scene?`,
    boldMessage: 'The other changes in the file will be lost. Choose Cancel and use Save As to keep both.',
    confirmLabel: 'Overwrite',
    cancelLabel: 'Cancel',
  });
}
