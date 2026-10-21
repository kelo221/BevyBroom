import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, cpSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** File name of the project file inside a project directory. */
export const PREVIEW_E2E_PROJECT_FILE_NAME = 'broom.project.json';

/**
 * Copies a game project to a fresh temporary directory so a test can change its
 * catalog and textures freely.
 *
 * @param sourceDirectory Directory holding broom.project.json and the assets
 *   folder.
 * @returns The temporary project directory.
 */
export function previewE2eProjectCopy(sourceDirectory: string): string {
  const targetDirectory = mkdtempSync(join(tmpdir(), 'broom_e2e_'));
  cpSync(join(sourceDirectory, PREVIEW_E2E_PROJECT_FILE_NAME), join(targetDirectory, PREVIEW_E2E_PROJECT_FILE_NAME));
  cpSync(join(sourceDirectory, 'assets'), join(targetDirectory, 'assets'), { recursive: true });
  return targetDirectory;
}

/**
 * Removes a temporary project directory, retrying while a just-stopped game
 * still holds its files.
 *
 * @param directory Directory to remove.
 */
export function previewE2eProjectRemove(directory: string): void {
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

/** Starts and stops the native game preview program. */
export class PreviewE2eGameProcess {
  private readonly executable: string;
  private readonly projectDirectory: string;
  private readonly port: number;
  private readonly isWindowShown: boolean;
  private readonly extraArguments: readonly string[];
  private child: ChildProcess | null = null;
  private readonly logFile: string;

  /**
   * Creates a stopped game process.
   *
   * @param executable Path of the preview executable.
   * @param projectDirectory Project directory the game runs in.
   * @param port Bridge port the game listens on.
   * @param isWindowShown Shows the game window; otherwise the game runs with a
   *   hidden window.
   * @param extraArguments More command line arguments, such as `--scene` or
   *   `--level`.
   */
  constructor(
    executable: string,
    projectDirectory: string,
    port: number,
    isWindowShown: boolean,
    extraArguments: readonly string[] = [],
  ) {
    this.executable = executable;
    this.projectDirectory = projectDirectory;
    this.port = port;
    this.isWindowShown = isWindowShown;
    this.extraArguments = extraArguments;
    this.logFile = join(projectDirectory, 'preview_e2e_game.log');
  }

  /**
   * Returns everything every started game wrote to its output so far.
   *
   * @returns Log text, empty before the first start.
   */
  logRead(): string {
    try {
      return readFileSync(this.logFile, 'utf8');
    } catch {
      return '';
    }
  }

  /**
   * Starts the game, appending its output to the log; it answers once its
   * window and bridge are up. The window stays hidden unless it was asked to be
   * shown.
   */
  start(): void {
    const projectArguments = [
      '--project',
      PREVIEW_E2E_PROJECT_FILE_NAME,
      '--port',
      String(this.port),
      ...this.extraArguments,
    ];
    if (!this.isWindowShown) {
      projectArguments.push('--hidden');
    }
    const logDescriptor = openSync(this.logFile, 'a');
    this.child = spawn(this.executable, projectArguments, {
      cwd: this.projectDirectory,
      stdio: ['ignore', logDescriptor, logDescriptor],
    });
    closeSync(logDescriptor);
  }

  /** Stops the game and waits until the process has exited. */
  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) {
      return;
    }
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
