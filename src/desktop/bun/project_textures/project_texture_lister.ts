import { isImageFileName } from '@/texture/library/image_file_filter.js';
import { ProjectFileLister } from '@/desktop/bun/project_files/project_file_lister.js';

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
    return ProjectFileLister.list(assetRoot, textureDirectories, isImageFileName);
  }
}
