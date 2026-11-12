import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type {
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
} from '@/io/dialog/desktop/file_dialog_desktop_types.js';

/** Shows the native open dialog and returns the chosen paths. */
export type TextFileOpenDialogShow = (allowedFileTypes: string) => Promise<string[]>;

/** Reads a text file. */
export type TextFileOpenReader = (path: string) => Promise<string>;

/** Request handlers of native text file dialogs. */
export interface TextFileOpenRpcHandlers {
  textFileOpen: (params: FileDialogDesktopTextFileOpenParams) => Promise<FileDialogDesktopTextFile | null>;
}

/**
 * Reads a file as UTF-8 text.
 *
 * @param path Absolute file path.
 * @returns File text.
 */
function textFileOpenReadUtf8(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

/**
 * Creates the handler that shows the native open dialog and reads the chosen
 * file.
 *
 * @param dialogShow Shows the native open dialog.
 * @param reader Reads the chosen file; defaults to UTF-8 file reading.
 * @returns Request handlers.
 */
export function textFileOpenRpcHandlersCreate(
  dialogShow: TextFileOpenDialogShow,
  reader: TextFileOpenReader = textFileOpenReadUtf8,
): TextFileOpenRpcHandlers {
  return {
    textFileOpen: async ({ allowedFileTypes }) => {
      const path = (await dialogShow(allowedFileTypes)).find((candidate) => candidate.trim() !== '');
      if (!path) {
        return null;
      }
      return { path, fileName: basename(path), text: await reader(path) };
    },
  };
}
