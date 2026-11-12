import type {
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
} from '@/io/dialog/desktop/file_dialog_desktop_types.js';

/** Native file dialogs offered by the desktop app. */
export interface FileDialogDesktopBridge {
  /**
   * Shows the native open dialog and reads the chosen text file.
   *
   * @param params Allowed file types.
   * @returns Chosen file with its text, or null when cancelled.
   */
  textFileOpen(params: FileDialogDesktopTextFileOpenParams): Promise<FileDialogDesktopTextFile | null>;
}

declare global {
  interface Window {
    bevybroomFileDialogDesktop?: FileDialogDesktopBridge;
  }
}

/**
 * Returns the native file dialogs installed by the desktop app, or null in a
 * browser.
 *
 * @returns Desktop file dialog bridge, or null.
 */
export function fileDialogDesktopBridgeResolve(): FileDialogDesktopBridge | null {
  return typeof window === 'undefined' ? null : (window.bevybroomFileDialogDesktop ?? null);
}

/**
 * Converts an input accept string such as ".vmf,text/plain" into the allowed
 * file types of the native dialog, such as "vmf". MIME types are dropped; with
 * no extension left every file is allowed.
 *
 * @param accept Input accept string.
 * @returns Comma separated extensions without dots, or "*".
 */
export function fileDialogDesktopAllowedFileTypesFromAccept(accept: string): string {
  const extensions = accept
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('.') && part.length > 1)
    .map((part) => part.slice(1).toLowerCase());
  return extensions.length > 0 ? [...new Set(extensions)].join(',') : '*';
}
