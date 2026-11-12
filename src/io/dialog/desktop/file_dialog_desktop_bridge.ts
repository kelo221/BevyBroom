import type {
  FileDialogDesktopFileStat,
  FileDialogDesktopFileStatParams,
  FileDialogDesktopSavePickParams,
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
  FileDialogDesktopTextFileWriteParams,
} from '@/io/dialog/desktop/file_dialog_desktop_types.js';

/** Native file dialogs and file access offered by the desktop app. */
export interface FileDialogDesktopBridge {
  /**
   * Shows the native open dialog and reads the chosen text file.
   *
   * @param params Allowed file types.
   * @returns Chosen file with its text, or null when cancelled.
   */
  textFileOpen(params: FileDialogDesktopTextFileOpenParams): Promise<FileDialogDesktopTextFile | null>;

  /**
   * Shows the native save dialog.
   *
   * @param params Suggested name and default extension.
   * @returns Chosen absolute path, or null when cancelled.
   */
  savePathPick(params: FileDialogDesktopSavePickParams): Promise<string | null>;

  /**
   * Replaces a text file with new contents.
   *
   * @param params Path and contents.
   * @returns Modification time after the write.
   */
  textFileWrite(params: FileDialogDesktopTextFileWriteParams): Promise<FileDialogDesktopFileStat>;

  /**
   * Reads the modification time of a file.
   *
   * @param params Path of the file.
   * @returns Modification time, or null when the file is missing.
   */
  fileStat(params: FileDialogDesktopFileStatParams): Promise<FileDialogDesktopFileStat | null>;
}

declare global {
  interface Window {
    bevybroomFileDialogDesktop?: FileDialogDesktopBridge;
  }
}

/**
 * Returns the native file dialogs installed by the desktop app, or null in a
 * browser and in desktop builds that keep the browser file pickers.
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
