import {
  PreviewLaunchCommandError,
  previewLaunchCommandFromSection,
  previewLaunchDirectoryJoin,
  previewLaunchOptionalStringRead,
  previewLaunchProjectParse,
  previewLaunchSectionRead,
  previewLaunchStringRead,
} from '@/preview/launch/preview_launch_command.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectBuildCommandResolver } from '@/project/build/project_build_command_resolver.js';

/** Name used for the top level of the project file in error messages. */
const PROJECT_SECTION_PATH = 'project';

/**
 * Turns the text of a game project file into the definition the editor uses.
 * Throws {@link PreviewLaunchCommandError} with a readable reason when the file
 * is malformed.
 */
export class ProjectDefinitionParser {
  /**
   * Parses a project file.
   *
   * @param projectJson Text of the project file.
   * @param projectFile Absolute path of the project file, forward or back
   *   slashes.
   * @returns Project definition.
   */
  static parse(projectJson: string, projectFile: string): ProjectDefinition {
    const project = previewLaunchProjectParse(projectJson);
    const projectFileNormalized = projectFile.replace(/\\/g, '/');
    const projectDirectory = ProjectDefinitionParser.directoryOf(projectFileNormalized);
    const projectIdentifier = previewLaunchStringRead(project, 'project_id', PROJECT_SECTION_PATH);
    const preview = previewLaunchSectionRead(project);
    const launch = previewLaunchCommandFromSection(preview, projectDirectory, 'preview');
    const assetRoot = ProjectDefinitionParser.assetRootRead(project, projectDirectory);
    return {
      projectFile: projectFileNormalized,
      projectDirectory,
      projectIdentifier,
      name: previewLaunchOptionalStringRead(project, 'name', PROJECT_SECTION_PATH) ?? projectIdentifier,
      assetRoot,
      levelDirectory: ProjectDefinitionParser.levelDirectoryRead(project, assetRoot),
      textureDirectories: ProjectDefinitionParser.assetDirectoriesRead(project, 'texture_directories'),
      sprinkleDirectories: ProjectDefinitionParser.assetDirectoriesRead(project, 'sprinkle_directories'),
      launch,
      build: ProjectBuildCommandResolver.resolve(preview, launch, projectDirectory),
    };
  }

  /**
   * Reads the asset root, which must stay inside the project.
   *
   * @param project Parsed project object.
   * @param projectDirectory Absolute project directory.
   * @returns Absolute asset root.
   */
  private static assetRootRead(project: Record<string, unknown>, projectDirectory: string): string {
    const assetRoot = previewLaunchStringRead(project, 'asset_root', PROJECT_SECTION_PATH);
    if (!ProjectDefinitionParser.isContainedRelativePath(assetRoot)) {
      throw new PreviewLaunchCommandError(`project.asset_root "${assetRoot}" must be a path inside the project`);
    }
    return previewLaunchDirectoryJoin(projectDirectory, assetRoot);
  }

  /**
   * Reads the level directory, which must stay inside the asset root.
   *
   * @param project Parsed project object.
   * @param assetRoot Absolute asset root.
   * @returns Absolute level directory.
   */
  private static levelDirectoryRead(project: Record<string, unknown>, assetRoot: string): string {
    const levelDirectory = previewLaunchStringRead(project, 'level_directory', PROJECT_SECTION_PATH);
    if (!ProjectDefinitionParser.isContainedRelativePath(levelDirectory)) {
      throw new PreviewLaunchCommandError(
        `project.level_directory "${levelDirectory}" must be a path inside the asset root`,
      );
    }
    return previewLaunchDirectoryJoin(assetRoot, levelDirectory);
  }

  /**
   * Reads an optional list of directories, each of which must stay inside the
   * asset root.
   *
   * @param project Parsed project object.
   * @param fieldName Top-level field holding the list, such as
   *   "texture_directories".
   * @returns Asset-root-relative directories with forward slashes, empty when
   *   the field is absent.
   */
  private static assetDirectoriesRead(project: Record<string, unknown>, fieldName: string): string[] {
    const value = project[fieldName] ?? [];
    if (!Array.isArray(value)) {
      throw new PreviewLaunchCommandError(`project.${fieldName} must be a list of strings`);
    }
    return value.map((directory: unknown) => ProjectDefinitionParser.assetDirectoryRead(directory, fieldName));
  }

  /**
   * Checks and normalizes one entry of a directory list.
   *
   * @param directory Entry from the project file.
   * @param fieldName Top-level field holding the list, used in messages.
   * @returns Asset-root-relative directory with forward slashes and no trailing
   *   slash.
   */
  private static assetDirectoryRead(directory: unknown, fieldName: string): string {
    if (typeof directory !== 'string' || directory.trim() === '') {
      throw new PreviewLaunchCommandError(`project.${fieldName} must be a list of non-empty strings`);
    }
    if (!ProjectDefinitionParser.isContainedRelativePath(directory)) {
      throw new PreviewLaunchCommandError(
        `project.${fieldName} entry "${directory}" must be a path inside the asset root`,
      );
    }
    return directory.replace(/\\/g, '/').replace(/\/+$/, '') || '.';
  }

  /**
   * Returns whether a path is relative and never climbs out of its base.
   *
   * @param path Path from the project file.
   * @returns True for contained relative paths.
   */
  static isContainedRelativePath(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    const isAbsolute = /^([a-zA-Z]:)?\//.test(normalized);
    return !isAbsolute && !normalized.split('/').includes('..');
  }

  /**
   * Returns the directory part of a forward-slash file path.
   *
   * @param filePath Forward-slash file path.
   * @returns Directory without a trailing slash.
   */
  private static directoryOf(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash <= 0 ? '.' : filePath.slice(0, lastSlash);
  }
}
