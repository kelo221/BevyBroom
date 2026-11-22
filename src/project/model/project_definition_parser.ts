import {
  PreviewLaunchCommandError,
  previewLaunchCommandFromSection,
  previewLaunchDirectoryJoin,
  previewLaunchOptionalStringRead,
  previewLaunchProjectParse,
  previewLaunchOptionalSectionRead,
  previewLaunchStringRead,
} from '@/preview/launch/preview_launch_command.js';
import { ProjectToolTexturesParser } from '@/project/model/project_tool_textures_parser.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { ProjectBuildCommandResolver } from '@/project/build/project_build_command_resolver.js';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import { ProjectLevelEntriesParser } from '@/project/model/project_level_entries_parser.js';
import { ProjectDataFieldsParser } from '@/project/model/project_data_fields_parser.js';

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
    const preview = previewLaunchOptionalSectionRead(project);
    const launch = preview === null ? null : previewLaunchCommandFromSection(preview, projectDirectory, 'preview');
    const assetRoot = ProjectDefinitionParser.assetRootRead(project, projectDirectory);
    return {
      projectFile: projectFileNormalized,
      projectDirectory,
      projectIdentifier,
      name: previewLaunchOptionalStringRead(project, 'name', PROJECT_SECTION_PATH) ?? projectIdentifier,
      assetRoot,
      levelDirectory: ProjectDefinitionParser.levelDirectoryRead(project, assetRoot),
      documentDirectory: ProjectDefinitionParser.documentDirectoryRead(project, projectDirectory),
      levels: ProjectLevelEntriesParser.levelsRead(project, ProjectDefinitionParser.isContainedRelativePath),
      textureDirectories: ProjectDefinitionParser.assetDirectoriesRead(project, 'texture_directories'),
      sprinkleDirectories: ProjectDefinitionParser.assetDirectoriesRead(project, 'sprinkle_directories'),
      entityClassesFile: ProjectDefinitionParser.projectPathJoin(
        projectDirectory,
        ProjectDataFieldsParser.entityClassesFileRead(project, ProjectDefinitionParser.isContainedRelativePath),
      ),
      prefabDirectory: ProjectDefinitionParser.projectPathJoin(
        projectDirectory,
        ProjectDataFieldsParser.prefabDirectoryRead(project, ProjectDefinitionParser.isContainedRelativePath),
      ),
      toolTextures: ProjectToolTexturesParser.read(project),
      launch,
      build:
        preview === null || launch === null
          ? null
          : ProjectBuildCommandResolver.resolve(preview, launch, projectDirectory),
      runConfigurations: RunConfigurationParser.projectRead(project),
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
   * Reads the document directory, which must stay inside the project directory
   * and defaults when absent.
   *
   * @param project Parsed project object.
   * @param projectDirectory Absolute project directory.
   * @returns Absolute document directory.
   */
  private static documentDirectoryRead(project: Record<string, unknown>, projectDirectory: string): string {
    const documentDirectory = ProjectLevelEntriesParser.documentDirectoryRead(
      project,
      ProjectDefinitionParser.isContainedRelativePath,
    );
    return previewLaunchDirectoryJoin(projectDirectory, documentDirectory);
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
   * Joins the project directory and an optional project-relative path.
   *
   * @param projectDirectory Absolute project directory.
   * @param relativePath Project-relative path, or null.
   * @returns Absolute path, or null when no path was given.
   */
  private static projectPathJoin(projectDirectory: string, relativePath: string | null): string | null {
    return relativePath === null ? null : previewLaunchDirectoryJoin(projectDirectory, relativePath);
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
