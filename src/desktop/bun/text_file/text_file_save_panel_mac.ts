import { spawn } from 'node:child_process';
import type { FileDialogDesktopSavePickParams } from '@/io/dialog/desktop/file_dialog_desktop_types.js';

/**
 * Escapes text for use inside an AppleScript string literal.
 *
 * @param text Raw text.
 * @returns Escaped text.
 */
export function textFileSavePanelMacQuote(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Builds the AppleScript that shows the macOS save panel in front, opened in
 * the starting folder when one is given, and prints the chosen POSIX path.
 *
 * @param params Suggested file name and optional starting folder.
 * @returns AppleScript source.
 */
export function textFileSavePanelMacScriptBuild(
  params: Pick<FileDialogDesktopSavePickParams, 'suggestedName' | 'startingDirectory'>,
): string {
  const defaultName = textFileSavePanelMacQuote(params.suggestedName);
  const location =
    params.startingDirectory === undefined
      ? ''
      : ` default location (POSIX file "${textFileSavePanelMacQuote(params.startingDirectory)}")`;
  return `activate\nPOSIX path of (choose file name with prompt "Save" default name "${defaultName}"${location})`;
}

/**
 * Adds an extension to a path whose file name has none.
 *
 * @param path Chosen path.
 * @param defaultExtension Extension without dot.
 * @returns Path with an extension.
 */
export function textFileSavePanelMacExtensionEnsure(path: string, defaultExtension: string): string {
  const fileName = path.split('/').pop() ?? path;
  return fileName.includes('.') || defaultExtension === '' ? path : `${path}.${defaultExtension}`;
}

/**
 * Shows the macOS save panel through osascript.
 *
 * @param params Suggested file name, extension added when the chosen name has
 *   none, and optional starting folder.
 * @returns Chosen absolute path, or null when cancelled.
 */
export function textFileSavePanelMacShow(params: FileDialogDesktopSavePickParams): Promise<string | null> {
  const defaultExtension = params.defaultExtension;
  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', textFileSavePanelMacScriptBuild(params)]);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.on('error', () => resolve(null));
    child.on('close', (exitCode) => {
      const path = output.trim();
      resolve(exitCode === 0 && path !== '' ? textFileSavePanelMacExtensionEnsure(path, defaultExtension) : null);
    });
  });
}
