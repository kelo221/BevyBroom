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
    return {
      projectFile: projectFileNormalized,
      projectDirectory,
      projectIdentifier,
      name: previewLaunchOptionalStringRead(project, 'name', PROJECT_SECTION_PATH) ?? projectIdentifier,
      assetRoot: ProjectDefinitionParser.assetRootRead(project, projectDirectory),
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
   * Returns whether a path is relative and never climbs out of its base.
   *
   * @param path Path from the project file.
   * @returns True for contained relative paths.
   */
  private static isContainedRelativePath(path: string): boolean {
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
