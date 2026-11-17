import { spawn } from 'node:child_process';
import { dirname } from 'node:path';

/** Program and arguments that open a file with the system's default application. */
export interface DesktopShellOpenCommand {
  /** Program to start. */
  readonly program: string;
  /** Arguments of the program. */
  readonly arguments: readonly string[];
  /** True when the arguments are already quoted for the Windows command line. */
  readonly isVerbatim: boolean;
}

/**
 * Opens files with the application the operating system associates with them,
 * and shows files in the system file manager.
 */
export class DesktopShellOpen {
  /**
   * Builds the command that opens a file on a platform.
   *
   * @param platform Node platform name such as "win32", "darwin" or "linux".
   * @param absolutePath Absolute path of the file.
   * @returns Command to start.
   */
  static commandBuild(platform: NodeJS.Platform, absolutePath: string): DesktopShellOpenCommand {
    if (platform === 'win32') {
      const windowsPath = DesktopShellOpen.windowsPathFrom(absolutePath);
      return { program: 'cmd.exe', arguments: ['/d', '/c', 'start', '""', `"${windowsPath}"`], isVerbatim: true };
    }
    const program = platform === 'darwin' ? 'open' : 'xdg-open';
    return { program, arguments: [absolutePath], isVerbatim: false };
  }

  /**
   * Builds the command that shows a file selected in the file manager of a
   * platform; Linux file managers open the file's folder.
   *
   * @param platform Node platform name such as "win32", "darwin" or "linux".
   * @param absolutePath Absolute path of the file.
   * @returns Command to start.
   */
  static revealCommandBuild(platform: NodeJS.Platform, absolutePath: string): DesktopShellOpenCommand {
    if (platform === 'win32') {
      const windowsPath = DesktopShellOpen.windowsPathFrom(absolutePath);
      return { program: 'explorer.exe', arguments: [`/select,"${windowsPath}"`], isVerbatim: true };
    }
    if (platform === 'darwin') {
      return { program: 'open', arguments: ['-R', absolutePath], isVerbatim: false };
    }
    return { program: 'xdg-open', arguments: [dirname(absolutePath)], isVerbatim: false };
  }

  /**
   * Opens a file with its default application without waiting for it to close.
   *
   * @param absolutePath Absolute path of the file.
   * @returns Resolves once the opener started; rejects when it cannot start.
   */
  static launch(absolutePath: string): Promise<void> {
    return DesktopShellOpen.commandStart(DesktopShellOpen.commandBuild(process.platform, absolutePath));
  }

  /**
   * Shows a file in the system file manager without waiting for it to close.
   *
   * @param absolutePath Absolute path of the file.
   * @returns Resolves once the file manager started; rejects when it cannot
   *   start.
   */
  static reveal(absolutePath: string): Promise<void> {
    return DesktopShellOpen.commandStart(DesktopShellOpen.revealCommandBuild(process.platform, absolutePath));
  }

  /**
   * Turns forward slashes into the backslashes Windows programs expect.
   *
   * @param absolutePath Absolute path with any separators.
   * @returns Path with backslashes.
   */
  private static windowsPathFrom(absolutePath: string): string {
    return absolutePath.replace(/\//g, '\\');
  }

  /**
   * Starts a command detached from the editor.
   *
   * @param command Program and arguments.
   * @returns Resolves once the program started; rejects when it cannot start.
   */
  private static commandStart(command: DesktopShellOpenCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command.program, [...command.arguments], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        windowsVerbatimArguments: command.isVerbatim,
      });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  }
}
