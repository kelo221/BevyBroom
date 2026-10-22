import { readFileSync, statSync } from 'node:fs';
import type { ProjectFileSystemProbe } from '@/project/model/project_definition_validator.js';

/** Reads project files and answers file system questions about a project. */
export interface GameProcessProjectReader extends ProjectFileSystemProbe {
  /**
   * Reads a text file.
   *
   * @param path Absolute path.
   * @returns File text.
   * @throws Error when the file cannot be read.
   */
  textRead(path: string): string;
}

/**
 * Returns the reader backed by the real file system.
 *
 * @returns File system project reader.
 */
export function gameProcessProjectReaderNodeCreate(): GameProcessProjectReader {
  return {
    textRead: (path) => readFileSync(path, 'utf8'),
    isDirectory: (path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false,
    isFile: (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false,
  };
}
