import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Name of the file or directory git keeps a checkout's repository data in. */
const PROJECT_FILE_GIT_ENTRY = '.git';

/**
 * File inside a worktree's git directory that names the shared repository
 * directory.
 */
const PROJECT_FILE_GIT_COMMON_DIRECTORY_FILE = 'commondir';

/**
 * Directory inside a git directory where git-annex keeps annexed files; it may
 * link elsewhere.
 */
const PROJECT_FILE_GIT_ANNEX_DIRECTORY = 'annex';

/**
 * Finds the repository directory git keeps for a project directory, where tools
 * such as git-annex keep the files the project links to. For a worktree this is
 * the shared directory of the main checkout.
 */
export class ProjectFileGitDirectory {
  /**
   * Returns the directories a project's linked files may really live in: its
   * shared git directory and the real place of that directory's annex store.
   *
   * @param projectDirectory Absolute project directory.
   * @returns Absolute directories, empty when the project is not the root of a
   *   git checkout.
   */
  static linkDirectoriesRead(projectDirectory: string): string[] {
    const commonDirectory = ProjectFileGitDirectory.commonDirectoryRead(projectDirectory);
    if (commonDirectory === null) {
      return [];
    }
    const annexDirectory = join(commonDirectory, PROJECT_FILE_GIT_ANNEX_DIRECTORY);
    return existsSync(annexDirectory) ? [commonDirectory, realpathSync(annexDirectory)] : [commonDirectory];
  }

  /**
   * Returns the shared git directory of a project directory.
   *
   * @param projectDirectory Absolute project directory.
   * @returns Absolute shared git directory, or null when the project is not the
   *   root of a git checkout.
   */
  static commonDirectoryRead(projectDirectory: string): string | null {
    const gitEntry = join(projectDirectory, PROJECT_FILE_GIT_ENTRY);
    if (!existsSync(gitEntry)) {
      return null;
    }
    if (statSync(gitEntry).isDirectory()) {
      return gitEntry;
    }
    const gitDirectory = ProjectFileGitDirectory.linkedDirectoryRead(projectDirectory, gitEntry);
    return gitDirectory === null ? null : ProjectFileGitDirectory.sharedDirectoryRead(gitDirectory);
  }

  /**
   * Reads the git directory a worktree's `.git` file points at.
   *
   * @param projectDirectory Absolute project directory.
   * @param gitFile Absolute path of the `.git` file.
   * @returns Absolute git directory of the worktree, or null when the file
   *   names none.
   */
  private static linkedDirectoryRead(projectDirectory: string, gitFile: string): string | null {
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(gitFile, 'utf8'));
    const gitDirectory = match?.[1]?.trim();
    if (!gitDirectory) {
      return null;
    }
    return isAbsolute(gitDirectory) ? gitDirectory : resolve(projectDirectory, gitDirectory);
  }

  /**
   * Returns the shared directory a worktree's git directory names, or the
   * directory itself when it names none.
   *
   * @param gitDirectory Absolute git directory of a worktree.
   * @returns Absolute shared git directory.
   */
  private static sharedDirectoryRead(gitDirectory: string): string {
    const commonFile = join(gitDirectory, PROJECT_FILE_GIT_COMMON_DIRECTORY_FILE);
    if (!existsSync(commonFile)) {
      return gitDirectory;
    }
    const common = readFileSync(commonFile, 'utf8').trim();
    return isAbsolute(common) ? common : resolve(gitDirectory, common);
  }
}
