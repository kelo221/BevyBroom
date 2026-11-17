import type { ProjectDefinition } from '@/project/model/project_definition.js';
import type { ProjectDataFileKind } from '@/project/data/project_data_file_types.js';
import { PROJECT_DATA_FILE_EXTENSION } from '@/project/model/project_data_fields_parser.js';

/**
 * Where one kind of project data lives: a directory of ".json" files, or one
 * fixed file in a directory.
 */
export interface ProjectDataLocation {
  /** Absolute directory, forward slashes. */
  directory: string;
  /** The only file name allowed, or null when every ".json" name is. */
  fixedFileName: string | null;
}

/** Resolves and checks the locations of project data files. */
export class ProjectDataLocationResolver {
  /**
   * Returns where a kind of data lives in a project.
   *
   * @param definition Open project.
   * @param kind Kind of data.
   * @returns Location, or null when the project file names none.
   */
  static locationRead(definition: ProjectDefinition, kind: ProjectDataFileKind): ProjectDataLocation | null {
    if (kind === 'prefabs') {
      return definition.prefabDirectory === null
        ? null
        : { directory: definition.prefabDirectory, fixedFileName: null };
    }
    return definition.entityClassesFile === null
      ? null
      : ProjectDataLocationResolver.fixedFileLocationCreate(definition.entityClassesFile);
  }

  /**
   * Explains why a file name is refused for a location.
   *
   * @param location Location the file would live in.
   * @param name Requested file name.
   * @returns Reason, or null when the name may be used.
   */
  static nameRefusalDescribe(location: ProjectDataLocation, name: string): string | null {
    if (location.fixedFileName !== null) {
      return name === location.fixedFileName ? null : `only ${location.fixedFileName} may be written here`;
    }
    const isPlainName = name.trim() !== '' && !/[\\/]/.test(name) && name !== '.' && name !== '..';
    if (!isPlainName) {
      return 'it is not a file name without directories';
    }
    return ProjectDataLocationResolver.isDataFileName(name) ? null : `it is not a ${PROJECT_DATA_FILE_EXTENSION} file`;
  }

  /**
   * Returns whether a file name is that of a project data file.
   *
   * @param name File name.
   * @returns True for ".json" files.
   */
  static isDataFileName(name: string): boolean {
    return name.toLowerCase().endsWith(PROJECT_DATA_FILE_EXTENSION);
  }

  /**
   * Splits an absolute file path into a location with that one file.
   *
   * @param filePath Absolute file path, forward slashes.
   * @returns Location of the file.
   */
  private static fixedFileLocationCreate(filePath: string): ProjectDataLocation {
    const lastSlash = filePath.lastIndexOf('/');
    return { directory: filePath.slice(0, lastSlash), fixedFileName: filePath.slice(lastSlash + 1) };
  }
}
