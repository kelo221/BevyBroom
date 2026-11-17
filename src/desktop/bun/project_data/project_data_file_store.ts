import { existsSync, readFileSync, statSync } from 'node:fs';
import { ProjectFileRealPath } from '@/desktop/bun/project_files/project_file_real_path.js';
import {
  projectFileSystemNodeCreate,
  projectFileWriteAtomic,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import {
  type ProjectDataLocation,
  ProjectDataLocationResolver,
} from '@/desktop/bun/project_data/project_data_location.js';
import type { ProjectDataFile, ProjectDataFileChangeResult } from '@/project/data/project_data_file_types.js';

/** Largest project data file read, in bytes. */
export const PROJECT_DATA_FILE_BYTE_LIMIT = 8 * 1024 * 1024;

/**
 * Reads, writes and removes the ".json" files of one project data location.
 * Files resolving outside their directory or larger than the limit are refused;
 * every write replaces the file in one rename.
 */
export class ProjectDataFileStore {
  private readonly fileSystem: ProjectFileSystem;
  private readonly byteLimit: number;

  /**
   * Creates a store.
   *
   * @param fileSystem File operations used for writing.
   * @param byteLimit Largest file size read, in bytes.
   */
  constructor(
    fileSystem: ProjectFileSystem = projectFileSystemNodeCreate(),
    byteLimit: number = PROJECT_DATA_FILE_BYTE_LIMIT,
  ) {
    this.fileSystem = fileSystem;
    this.byteLimit = byteLimit;
  }

  /**
   * Reads every data file of a location, sorted by name; a missing directory or
   * fixed file reads as no files.
   *
   * @param location Location to read.
   * @returns Files.
   * @throws Error naming a file that cannot be read.
   */
  readAll(location: ProjectDataLocation): ProjectDataFile[] {
    return this.fileNamesList(location)
      .sort((first, second) => first.localeCompare(second))
      .map((name) => ({ name, text: this.fileRead(location.directory, name) }));
  }

  /**
   * Writes one data file, creating its directory when needed.
   *
   * @param location Location the file belongs to.
   * @param name File name.
   * @param text File text.
   * @returns Success, or why nothing was written.
   */
  write(location: ProjectDataLocation, name: string, text: string): ProjectDataFileChangeResult {
    const refusal = ProjectDataLocationResolver.nameRefusalDescribe(location, name);
    if (refusal !== null) {
      return { ok: false, message: `Cannot write "${name}": ${refusal}.` };
    }
    this.fileSystem.directoryEnsure(location.directory);
    projectFileWriteAtomic(this.fileSystem, `${location.directory}/${name}`, new TextEncoder().encode(text));
    return { ok: true };
  }

  /**
   * Removes one data file; a missing file counts as removed.
   *
   * @param location Location the file belongs to.
   * @param name File name.
   * @returns Success, or why nothing was removed.
   */
  remove(location: ProjectDataLocation, name: string): ProjectDataFileChangeResult {
    const refusal = ProjectDataLocationResolver.nameRefusalDescribe(location, name);
    if (refusal !== null) {
      return { ok: false, message: `Cannot remove "${name}": ${refusal}.` };
    }
    this.fileSystem.fileRemove(`${location.directory}/${name}`);
    return { ok: true };
  }

  /**
   * Lists the data file names present in a location.
   *
   * @param location Location to list.
   * @returns File names.
   */
  private fileNamesList(location: ProjectDataLocation): string[] {
    if (location.fixedFileName !== null) {
      return existsSync(`${location.directory}/${location.fixedFileName}`) ? [location.fixedFileName] : [];
    }
    if (!existsSync(location.directory)) {
      return [];
    }
    return this.fileSystem.fileNamesList(location.directory).filter(ProjectDataLocationResolver.isDataFileName);
  }

  /**
   * Reads one file after checking where it really lives and how large it is.
   *
   * @param directory Absolute directory of the file.
   * @param name File name.
   * @returns File text.
   * @throws Error naming the file when it is refused.
   */
  private fileRead(directory: string, name: string): string {
    const realFilePath = ProjectFileRealPath.insideRootResolve(directory, name);
    if (realFilePath === null) {
      throw new Error(`"${name}" resolves outside ${directory}`);
    }
    const byteSize = statSync(realFilePath).size;
    if (byteSize > this.byteLimit) {
      throw new Error(`"${name}" has ${byteSize} bytes, more than the limit of ${this.byteLimit}`);
    }
    return readFileSync(realFilePath, 'utf8');
  }
}
