import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';

/** Resolves where a file below a project directory really lives on disk. */
export class ProjectFileRealPath {
  /**
   * Resolves links of a file below a root directory, such as the asset root or
   * the document directory, and checks that the real file is still inside the
   * real root.
   *
   * @param rootDirectory Absolute root directory.
   * @param relativePath Normalized path relative to the root.
   * @returns Real absolute path, or null when it resolves outside the root or
   *   is the root itself.
   * @throws Error when the file does not exist.
   */
  static insideRootResolve(rootDirectory: string, relativePath: string): string | null {
    const realFilePath = realpathSync(ProjectFilePaths.absoluteJoin(rootDirectory, relativePath));
    const pathFromRoot = relative(realpathSync(rootDirectory), realFilePath);
    const isOutside = pathFromRoot === '' || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot);
    return isOutside ? null : realFilePath;
  }
}
