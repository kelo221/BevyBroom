import { spawnSync } from 'node:child_process';
import { delimiter } from 'node:path';

/**
 * Text printed right before the login shell's PATH, so start-up noise is
 * skipped.
 */
export const GAME_PROCESS_SHELL_PATH_MARKER = '__BROOM_SHELL_PATH__';

/** Longest time the login shell may take to report its PATH, in milliseconds. */
const GAME_PROCESS_SHELL_PATH_TIMEOUT_MILLISECONDS = 5000;

/** Shell used when the environment names none. */
const GAME_PROCESS_SHELL_FALLBACK = '/bin/sh';

/**
 * Runs a login shell and returns everything it printed.
 *
 * @param shell Absolute path of the shell program.
 * @param script Script the shell runs.
 * @returns Printed text, or null when the shell could not run.
 */
export type GameProcessShellRunner = (shell: string, script: string) => string | null;

/**
 * Runs a shell as an interactive login shell, the way a terminal starts it.
 *
 * @param shell Absolute path of the shell program.
 * @param script Script the shell runs.
 * @returns Printed text, or null when the shell failed or timed out.
 */
export function gameProcessShellRunnerNode(shell: string, script: string): string | null {
  const result = spawnSync(shell, ['-ilc', script], {
    encoding: 'utf8',
    timeout: GAME_PROCESS_SHELL_PATH_TIMEOUT_MILLISECONDS,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.error || typeof result.stdout !== 'string' ? null : result.stdout;
}

/**
 * Builds the environment programs of a game project start with. An app opened
 * from the macOS Finder or a Linux desktop launcher gets a minimal PATH; this
 * adds the PATH the user's login shell has, so programs such as `bun` or
 * `cargo` installed for the user are found.
 */
export class GameProcessEnvironmentShellPath {
  private readonly appEnvironment: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly shellRunner: GameProcessShellRunner;
  private cachedEnvironment: NodeJS.ProcessEnv | null = null;

  /**
   * Creates the environment builder.
   *
   * @param appEnvironment Environment of the editor process.
   * @param platform Operating system the editor runs on.
   * @param shellRunner Runs the login shell that reports its PATH.
   */
  constructor(
    appEnvironment: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform,
    shellRunner: GameProcessShellRunner = gameProcessShellRunnerNode,
  ) {
    this.appEnvironment = appEnvironment;
    this.platform = platform;
    this.shellRunner = shellRunner;
  }

  /**
   * Returns the environment with the merged PATH, asking the login shell once.
   *
   * @returns Environment for started programs.
   */
  environmentRead(): NodeJS.ProcessEnv {
    if (this.cachedEnvironment === null) {
      this.cachedEnvironment = this.environmentBuild();
    }
    return this.cachedEnvironment;
  }

  /**
   * Builds the environment: the editor's own, with the login shell's PATH
   * entries first and the editor's remaining entries after them.
   *
   * @returns Environment for started programs.
   */
  private environmentBuild(): NodeJS.ProcessEnv {
    const appPath = this.appEnvironment['PATH'] ?? '';
    const shellPath = this.platform === 'win32' ? null : this.shellPathRead();
    if (shellPath === null) {
      return { ...this.appEnvironment };
    }
    return { ...this.appEnvironment, PATH: GameProcessEnvironmentShellPath.pathMerge(shellPath, appPath) };
  }

  /**
   * Asks the user's login shell for its PATH.
   *
   * @returns PATH of the login shell, or null when it could not be read.
   */
  private shellPathRead(): string | null {
    const shell = this.appEnvironment['SHELL'] || GAME_PROCESS_SHELL_FALLBACK;
    const printed = this.shellRunner(shell, `printf '%s%s' '${GAME_PROCESS_SHELL_PATH_MARKER}' "$PATH"`);
    const markerIndex = printed?.lastIndexOf(GAME_PROCESS_SHELL_PATH_MARKER) ?? -1;
    if (printed === null || printed === undefined || markerIndex < 0) {
      return null;
    }
    const shellPath = printed.slice(markerIndex + GAME_PROCESS_SHELL_PATH_MARKER.length).trim();
    return shellPath === '' ? null : shellPath;
  }

  /**
   * Joins two PATH values, keeping each directory once in first-seen order.
   *
   * @param preferredPath PATH whose directories come first.
   * @param remainingPath PATH whose new directories are appended.
   * @returns Merged PATH.
   */
  static pathMerge(preferredPath: string, remainingPath: string): string {
    const directories = [...preferredPath.split(delimiter), ...remainingPath.split(delimiter)];
    return [...new Set(directories.filter((directory) => directory !== ''))].join(delimiter);
  }
}
