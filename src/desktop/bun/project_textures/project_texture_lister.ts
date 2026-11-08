import { readdirSync, statSync } from 'node:fs';
import { isImageFileName } from '@/texture/library/image_file_filter.js';
import { ProjectTexturePaths } from '@/desktop/bun/project_textures/project_texture_paths.js';

/** Finds the images of a project's texture directories on disk. */
export class ProjectTextureLister {
  /**
   * Lists every image below the texture directories; directories that do not
   * exist are skipped.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param textureDirectories Directories relative to the asset root.
   * @returns Image paths relative to the asset root, forward slashes, sorted
   *   and without duplicates.
   */
  static list(assetRoot: string, textureDirectories: readonly string[]): string[] {
    const collected = new Set<string>();
    textureDirectories
      .map((directory) => ProjectTexturePaths.relativeNormalize(directory))
      .filter((directory) => ProjectTextureLister.isDirectory(ProjectTexturePaths.absoluteJoin(assetRoot, directory)))
      .forEach((directory) => ProjectTextureLister.directoryWalk(assetRoot, directory, collected));
    return Array.from(collected).sort();
  }

  /**
   * Adds the images of one directory and of all its subdirectories.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param relativeDirectory Normalized directory relative to the asset root.
   * @param collected Image paths found so far, extended in place.
   */
  private static directoryWalk(assetRoot: string, relativeDirectory: string, collected: Set<string>): void {
    const absoluteDirectory = ProjectTexturePaths.absoluteJoin(assetRoot, relativeDirectory);
    readdirSync(absoluteDirectory, { withFileTypes: true }).forEach((directoryEntry) => {
      const relativePath = ProjectTexturePaths.relativeJoin(relativeDirectory, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        ProjectTextureLister.directoryWalk(assetRoot, relativePath, collected);
      } else if (directoryEntry.isFile() && isImageFileName(directoryEntry.name)) {
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
