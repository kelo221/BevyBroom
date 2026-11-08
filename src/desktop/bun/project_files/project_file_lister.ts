import { readdirSync, statSync } from 'node:fs';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';

/** Decides from its name whether a file is listed. */
export type ProjectFileNameFilter = (fileName: string) => boolean;

/** Finds the files of chosen kinds below directories of a project's asset root. */
export class ProjectFileLister {
  /**
   * Lists every accepted file below the directories; directories that do not
   * exist are skipped.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param directories Directories relative to the asset root.
   * @param fileNameAccepts Decides from a file name whether it is listed.
   * @returns File paths relative to the asset root, forward slashes, sorted and
   *   without duplicates.
   */
  static list(assetRoot: string, directories: readonly string[], fileNameAccepts: ProjectFileNameFilter): string[] {
    const collected = new Set<string>();
    directories
      .map((directory) => ProjectFilePaths.relativeNormalize(directory))
      .filter((directory) => ProjectFileLister.isDirectory(ProjectFilePaths.absoluteJoin(assetRoot, directory)))
      .forEach((directory) => ProjectFileLister.directoryWalk(assetRoot, directory, fileNameAccepts, collected));
    return Array.from(collected).sort();
  }

  /**
   * Adds the accepted files of one directory and of all its subdirectories.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param relativeDirectory Normalized directory relative to the asset root.
   * @param fileNameAccepts Decides from a file name whether it is listed.
   * @param collected File paths found so far, extended in place.
   */
  private static directoryWalk(
    assetRoot: string,
    relativeDirectory: string,
    fileNameAccepts: ProjectFileNameFilter,
    collected: Set<string>,
  ): void {
    const absoluteDirectory = ProjectFilePaths.absoluteJoin(assetRoot, relativeDirectory);
    readdirSync(absoluteDirectory, { withFileTypes: true }).forEach((directoryEntry) => {
      const relativePath = ProjectFilePaths.relativeJoin(relativeDirectory, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        ProjectFileLister.directoryWalk(assetRoot, relativePath, fileNameAccepts, collected);
      } else if (directoryEntry.isFile() && fileNameAccepts(directoryEntry.name)) {
        collected.add(relativePath);
      }
    });
  }

  /**
   * Returns whether a path is an existing directory.
   *
   * @param path Absolute path.
   * @returns True for directories.
   */
  private static isDirectory(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
  }
}
