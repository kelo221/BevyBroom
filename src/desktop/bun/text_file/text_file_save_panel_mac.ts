import { spawn } from 'node:child_process';

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
 * Builds the AppleScript that shows the macOS save panel in front and prints
 * the chosen POSIX path.
 *
 * @param suggestedName File name the panel suggests.
 * @returns AppleScript source.
 */
export function textFileSavePanelMacScriptBuild(suggestedName: string): string {
  const defaultName = textFileSavePanelMacQuote(suggestedName);
  return `activate\nPOSIX path of (choose file name with prompt "Save" default name "${defaultName}")`;
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
 * @param suggestedName File name the panel suggests.
 * @param defaultExtension Extension added when the chosen name has none.
 * @returns Chosen absolute path, or null when cancelled.
 */
export function textFileSavePanelMacShow(suggestedName: string, defaultExtension: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', textFileSavePanelMacScriptBuild(suggestedName)]);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.on('error', () => resolve(null));
    child.on('close', (exitCode) => {
      const path = output.trim();
      resolve(exitCode === 0 && path !== '' ? textFileSavePanelMacExtensionEnsure(path, defaultExtension) : null);
    });
  });
}
