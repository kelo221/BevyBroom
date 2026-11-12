import { basename } from 'node:path';
import type {
  FileDialogDesktopFileStat,
  FileDialogDesktopFileStatParams,
  FileDialogDesktopSavePickParams,
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
  FileDialogDesktopTextFileWriteParams,
} from '@/io/dialog/desktop/file_dialog_desktop_types.js';
import {
  textFileDiskModifiedRead,
  textFileDiskRead,
  textFileDiskWriteAtomically,
} from '@/desktop/bun/text_file/text_file_disk.js';

/** Native dialogs and disk access the text file handlers use. */
export interface TextFileRpcServices {
  /** Shows the native open dialog and returns the chosen paths. */
  readonly openDialogShow: (allowedFileTypes: string) => Promise<string[]>;
  /** Shows the native save dialog and returns the chosen path, or null. */
  readonly savePanelShow: (suggestedName: string, defaultExtension: string) => Promise<string | null>;
  /** Reads a text file. */
  readonly textRead: (path: string) => Promise<string>;
  /** Reads a modification time, or null when the file is missing. */
  readonly modifiedRead: (path: string) => Promise<number | null>;
  /** Replaces a text file and returns its new modification time. */
  readonly textWrite: (path: string, text: string) => Promise<number>;
}

/** Request handlers of native text file dialogs and file access. */
export interface TextFileRpcHandlers {
  textFileOpen: (params: FileDialogDesktopTextFileOpenParams) => Promise<FileDialogDesktopTextFile | null>;
  savePathPick: (params: FileDialogDesktopSavePickParams) => Promise<string | null>;
  textFileWrite: (params: FileDialogDesktopTextFileWriteParams) => Promise<FileDialogDesktopFileStat>;
  fileStat: (params: FileDialogDesktopFileStatParams) => Promise<FileDialogDesktopFileStat | null>;
}

/**
 * Fills the disk services of the text file handlers with real file access.
 *
 * @param dialogs Native open and save dialogs.
 * @returns Complete services.
 */
export function textFileRpcServicesDiskCreate(
  dialogs: Pick<TextFileRpcServices, 'openDialogShow' | 'savePanelShow'>,
): TextFileRpcServices {
  return {
    ...dialogs,
    textRead: textFileDiskRead,
    modifiedRead: textFileDiskModifiedRead,
    textWrite: textFileDiskWriteAtomically,
  };
}

/**
 * Shows the open dialog and reads the first chosen file.
 *
 * @param services Dialogs and disk access.
 * @param allowedFileTypes Allowed extensions.
 * @returns Chosen file with text, or null when cancelled.
 */
async function textFileRpcOpen(
  services: TextFileRpcServices,
  allowedFileTypes: string,
): Promise<FileDialogDesktopTextFile | null> {
  const path = (await services.openDialogShow(allowedFileTypes)).find((candidate) => candidate.trim() !== '');
  if (!path) {
    return null;
  }
  const text = await services.textRead(path);
  return { path, fileName: basename(path), text, lastModified: (await services.modifiedRead(path)) ?? 0 };
}

/**
 * Creates the handlers of native text file dialogs and file access.
 *
 * @param services Dialogs and disk access.
 * @returns Request handlers.
 */
export function textFileRpcHandlersCreate(services: TextFileRpcServices): TextFileRpcHandlers {
  return {
    textFileOpen: ({ allowedFileTypes }) => textFileRpcOpen(services, allowedFileTypes),
    savePathPick: ({ suggestedName, defaultExtension }) => services.savePanelShow(suggestedName, defaultExtension),
    textFileWrite: async ({ path, text }) => ({ lastModified: await services.textWrite(path, text) }),
    fileStat: async ({ path }) => {
      const lastModified = await services.modifiedRead(path);
      return lastModified === null ? null : { lastModified };
    },
  };
}
