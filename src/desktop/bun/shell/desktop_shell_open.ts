import { spawn } from 'node:child_process';

/** Program and arguments that open a file with the system's default application. */
export interface DesktopShellOpenCommand {
  /** Program to start. */
  readonly program: string;
  /** Arguments of the program. */
  readonly arguments: readonly string[];
  /** True when the arguments are already quoted for the Windows command line. */
  readonly isVerbatim: boolean;
}

/** Opens files with the application the operating system associates with them. */
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
      const windowsPath = absolutePath.replace(/\//g, '\\');
      return { program: 'cmd.exe', arguments: ['/d', '/c', 'start', '""', `"${windowsPath}"`], isVerbatim: true };
    }
    const program = platform === 'darwin' ? 'open' : 'xdg-open';
    return { program, arguments: [absolutePath], isVerbatim: false };
  }

  /**
   * Opens a file with its default application without waiting for it to close.
   *
   * @param absolutePath Absolute path of the file.
   * @returns Resolves once the opener started; rejects when it cannot start.
   */
  static launch(absolutePath: string): Promise<void> {
    const command = DesktopShellOpen.commandBuild(process.platform, absolutePath);
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
