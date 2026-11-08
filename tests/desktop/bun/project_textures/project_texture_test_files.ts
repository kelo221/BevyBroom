import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Temporary directories created by the running test file. */
const projectTextureTestDirectories: string[] = [];

/**
 * Creates a fresh temporary asset root.
 *
 * @returns Absolute asset root with forward slashes.
 */
export function projectTextureTestAssetRootCreate(): string {
  const directory = mkdtempSync(join(tmpdir(), 'broom-project-textures-'));
  projectTextureTestDirectories.push(directory);
  return directory.replace(/\\/g, '/');
}

/**
 * Writes a file below a directory, creating its parent directories.
 *
 * @param baseDirectory Absolute directory the path is relative to.
 * @param relativePath Forward-slash path of the file.
 * @param contents File contents.
 */
export function projectTextureTestFileWrite(
  baseDirectory: string,
  relativePath: string,
  contents: string | Uint8Array,
): void {
  const filePath = join(baseDirectory, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

/** Removes every temporary directory created so far. */
export function projectTextureTestDirectoriesRemove(): void {
  projectTextureTestDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
}
