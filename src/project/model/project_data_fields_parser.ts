import { PreviewLaunchCommandError } from '@/preview/launch/preview_launch_command.js';

/** Top-level field naming the project's game entity class file. */
export const PROJECT_ENTITY_CLASSES_FIELD = 'entity_classes';

/** Top-level field naming the project's prefab directory. */
export const PROJECT_PREFAB_DIRECTORY_FIELD = 'prefab_directory';

/** File name extension every project data file carries. */
export const PROJECT_DATA_FILE_EXTENSION = '.json';

/**
 * Reads the optional project file fields that name editor data shared by every
 * level of a project: the game entity class file and the prefab directory.
 * Throws {@link PreviewLaunchCommandError} naming the field when one is
 * malformed.
 */
export class ProjectDataFieldsParser {
  /**
   * Reads the class file path relative to the project directory.
   *
   * @param project Parsed project object.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Project-relative ".json" path, or null when the field is absent.
   */
  static entityClassesFileRead(
    project: Record<string, unknown>,
    isContainedRelativePath: (path: string) => boolean,
  ): string | null {
    const path = ProjectDataFieldsParser.containedPathRead(
      project,
      PROJECT_ENTITY_CLASSES_FIELD,
      isContainedRelativePath,
    );
    if (path !== null && !path.toLowerCase().endsWith(PROJECT_DATA_FILE_EXTENSION)) {
      throw new PreviewLaunchCommandError(`project.${PROJECT_ENTITY_CLASSES_FIELD} "${path}" must name a .json file`);
    }
    return path;
  }

  /**
   * Reads the prefab directory relative to the project directory.
   *
   * @param project Parsed project object.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Project-relative directory, or null when the field is absent.
   */
  static prefabDirectoryRead(
    project: Record<string, unknown>,
    isContainedRelativePath: (path: string) => boolean,
  ): string | null {
    return ProjectDataFieldsParser.containedPathRead(project, PROJECT_PREFAB_DIRECTORY_FIELD, isContainedRelativePath);
  }

  /**
   * Reads an optional non-empty path field that must stay inside the project.
   *
   * @param project Parsed project object.
   * @param fieldName Top-level field name.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Path with forward slashes and no trailing slash, or null when the
   *   field is absent.
   */
  private static containedPathRead(
    project: Record<string, unknown>,
    fieldName: string,
    isContainedRelativePath: (path: string) => boolean,
  ): string | null {
    const value = project[fieldName];
    if (value === undefined) {
      return null;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PreviewLaunchCommandError(`project.${fieldName} must be a non-empty string`);
    }
    if (!isContainedRelativePath(value)) {
      throw new PreviewLaunchCommandError(`project.${fieldName} "${value}" must be a path inside the project`);
    }
    return value.replace(/\\/g, '/').replace(/\/+$/, '') || '.';
  }
}
