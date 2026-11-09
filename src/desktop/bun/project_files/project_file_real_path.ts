import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';

/** Resolves where a file of a project's asset root really lives on disk. */
export class ProjectFileRealPath {
  /**
   * Resolves links of a file below the asset root and checks that the real file
   * is still inside the real asset root.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Normalized path relative to the asset root.
   * @returns Real absolute path, or null when it resolves outside the asset
   *   root or is the asset root itself.
   * @throws Error when the file does not exist.
   */
  static insideAssetRootResolve(assetRoot: string, relativePath: string): string | null {
    const realFilePath = realpathSync(ProjectFilePaths.absoluteJoin(assetRoot, relativePath));
    const pathFromRoot = relative(realpathSync(assetRoot), realFilePath);
    const isOutside = pathFromRoot === '' || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot);
    return isOutside ? null : realFilePath;
  }
}
