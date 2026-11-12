import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs';

/** File operations the writers of project files need. */
export interface ProjectFileSystem {
  /**
   * Creates a directory and its parents.
   *
   * @param path Absolute directory.
   */
  directoryEnsure(path: string): void;
  /**
   * Lists the file names of a directory.
   *
   * @param path Absolute directory.
   * @returns File names, empty when the directory is missing.
   */
  fileNamesList(path: string): string[];
  /**
   * Writes bytes to a file and flushes them to disk.
   *
   * @param path Absolute file path.
   * @param bytes File content.
   */
  fileWriteFlushed(path: string, bytes: Uint8Array): void;
  /**
   * Renames a file, replacing the target.
   *
   * @param from Existing path.
   * @param to New path.
   */
  fileRename(from: string, to: string): void;
  /**
   * Deletes a file when it exists.
   *
   * @param path Absolute file path.
   */
  fileRemove(path: string): void;
}

/**
 * Returns the file operations backed by the real file system.
 *
 * @returns Node file system operations.
 */
export function projectFileSystemNodeCreate(): ProjectFileSystem {
  return {
    directoryEnsure: (path) => mkdirSync(path, { recursive: true }),
    fileNamesList: (path) => readdirSync(path),
    fileWriteFlushed: (path, bytes) => projectFileWriteFlushed(path, bytes),
    fileRename: (from, to) => renameSync(from, to),
    fileRemove: (path) => rmSync(path, { force: true }),
  };
}

/**
 * Writes a file through a flushed temporary sibling and a rename, so a reader
 * never sees a half-written file and a failed write leaves the old file as it
 * was.
 *
 * @param fileSystem File operations.
 * @param path Final file path.
 * @param bytes File content.
 */
export function projectFileWriteAtomic(fileSystem: ProjectFileSystem, path: string, bytes: Uint8Array): void {
  const temporaryPath = `${path}.tmp`;
  fileSystem.fileWriteFlushed(temporaryPath, bytes);
  fileSystem.fileRename(temporaryPath, path);
}

/**
 * Writes bytes to a file and flushes them before closing it.
 *
 * @param path Absolute file path.
 * @param bytes File content.
 */
function projectFileWriteFlushed(path: string, bytes: Uint8Array): void {
  const descriptor = openSync(path, 'w');
  try {
    writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
