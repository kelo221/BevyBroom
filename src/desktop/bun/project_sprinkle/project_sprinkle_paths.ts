import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';

/** File name extension of sprinkle definition files, compared without case. */
export const PROJECT_SPRINKLE_DEFINITION_EXTENSION = '.txt';

/** Rules for which files of a project are sprinkle definition files. */
export class ProjectSprinklePaths {
  /**
   * Returns whether a file name is that of a sprinkle definition file.
   *
   * @param fileName File name or path.
   * @returns True for ".txt" files.
   */
  static isDefinitionFileName(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(PROJECT_SPRINKLE_DEFINITION_EXTENSION);
  }

  /**
   * Explains why a requested definition path is refused before touching the
   * disk.
   *
   * @param sprinkleDirectories Directories relative to the asset root.
   * @param definitionPath Requested path relative to the asset root.
   * @returns Reason, or null when the path may be used.
   */
  static refusalDescribe(sprinkleDirectories: readonly string[], definitionPath: string): string | null {
    if (definitionPath.trim() === '' || !ProjectDefinitionParser.isContainedRelativePath(definitionPath)) {
      return 'it is not a path inside the asset root';
    }
    if (!ProjectSprinklePaths.isDefinitionFileName(definitionPath)) {
      return 'it is not a .txt file';
    }
    const relativePath = ProjectFilePaths.relativeNormalize(definitionPath);
    const isInside = ProjectFilePaths.isInsideAnyDirectory(relativePath, sprinkleDirectories);
    return isInside ? null : 'it is not inside a sprinkle directory of the project';
  }
}
