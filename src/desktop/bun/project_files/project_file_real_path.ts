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
    return ProjectFileRealPath.insideLinkRootsResolve(rootDirectory, relativePath, [rootDirectory]);
  }

  /**
   * Resolves links of a file below a root directory and checks that the real
   * file is inside one of the link roots, such as the project directory and its
   * git directory, so links a version control tool keeps for the project
   * (git-annex, for one) are followed while links anywhere else are refused.
   *
   * @param rootDirectory Absolute root directory the path is relative to.
   * @param relativePath Normalized path relative to the root.
   * @param linkRootDirectories Absolute directories the real file may be
   *   inside.
   * @returns Real absolute path, or null when it resolves outside every link
   *   root or is one of them.
   * @throws Error when the file does not exist.
   */
  static insideLinkRootsResolve(
    rootDirectory: string,
    relativePath: string,
    linkRootDirectories: readonly string[],
  ): string | null {
    const realFilePath = realpathSync(ProjectFilePaths.absoluteJoin(rootDirectory, relativePath));
    const isInside = linkRootDirectories.some((linkRoot) =>
      ProjectFileRealPath.isStrictlyInside(linkRoot, realFilePath),
    );
    return isInside ? realFilePath : null;
  }

  /**
   * Returns whether a real file lies below a directory.
   *
   * @param directory Absolute directory; links in it are resolved.
   * @param realFilePath Real absolute file path.
   * @returns True when the file is inside the directory and is not the
   *   directory itself.
   */
  private static isStrictlyInside(directory: string, realFilePath: string): boolean {
    const pathFromRoot = relative(realpathSync(directory), realFilePath);
    return pathFromRoot !== '' && !pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot);
  }
}
