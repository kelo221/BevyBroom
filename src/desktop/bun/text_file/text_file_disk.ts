import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';

/**
 * Reads a file as UTF-8 text.
 *
 * @param path Absolute file path.
 * @returns File text.
 */
export function textFileDiskRead(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

/**
 * Reads the modification time of a file.
 *
 * @param path Absolute file path.
 * @returns Modification time in milliseconds, or null when the file is missing.
 */
export async function textFileDiskModifiedRead(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Replaces a file atomically: writes a sibling temporary file and renames it
 * over the target, so a failed write leaves the old file intact.
 *
 * @param path Absolute file path.
 * @param text Complete file contents.
 * @returns Modification time after the write.
 */
export async function textFileDiskWriteAtomically(path: string, text: string): Promise<number> {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temporaryPath, text, 'utf8');
  await rename(temporaryPath, path);
  return (await textFileDiskModifiedRead(path)) ?? Date.now();
}
