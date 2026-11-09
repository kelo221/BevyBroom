/** Path helpers for files relative to a project's asset root. */
export class ProjectFilePaths {
  /**
   * Turns a relative path into forward slashes without empty or "." segments;
   * the asset root itself becomes empty.
   *
   * @param relativePath Path relative to the asset root, either slash.
   * @returns Normalized relative path.
   */
  static relativeNormalize(relativePath: string): string {
    return relativePath
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment !== '' && segment !== '.')
      .join('/');
  }

  /**
   * Joins a normalized relative directory and a name.
   *
   * @param relativeDirectory Relative directory; empty for the asset root.
   * @param name File or directory name.
   * @returns Relative path, forward slashes.
   */
  static relativeJoin(relativeDirectory: string, name: string): string {
    return relativeDirectory === '' ? name : `${relativeDirectory}/${name}`;
  }

  /**
   * Joins the asset root and a normalized relative path.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Relative path; empty for the asset root itself.
   * @returns Absolute path.
   */
  static absoluteJoin(assetRoot: string, relativePath: string): string {
    return relativePath === '' ? assetRoot : `${assetRoot}/${relativePath}`;
  }

  /**
   * Returns whether a normalized relative path lies inside a normalized
   * relative directory.
   *
   * @param relativePath Relative file path.
   * @param relativeDirectory Relative directory; empty for the asset root.
   * @returns True when the path is below the directory.
   */
  static isInsideDirectory(relativePath: string, relativeDirectory: string): boolean {
    return relativeDirectory === '' || relativePath.startsWith(`${relativeDirectory}/`);
  }

  /**
   * Returns whether a normalized relative path lies inside any of several
   * directories.
   *
   * @param relativePath Relative file path.
   * @param directories Directories relative to the asset root, not yet
   *   normalized.
   * @returns True when the path is below at least one directory.
   */
  static isInsideAnyDirectory(relativePath: string, directories: readonly string[]): boolean {
    return directories.some((directory) =>
      ProjectFilePaths.isInsideDirectory(relativePath, ProjectFilePaths.relativeNormalize(directory)),
    );
  }
}
