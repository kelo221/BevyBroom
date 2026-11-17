import { describe, expect, it } from 'vitest';
import { delimiter } from 'node:path';
import {
  GAME_PROCESS_SHELL_PATH_MARKER,
  GameProcessEnvironmentShellPath,
  type GameProcessShellRunner,
} from '@/desktop/bun/game_process/game_process_environment_shell_path.js';

/**
 * Builds a shell runner that prints start-up noise and then answers the PATH
 * script with the given PATH, counting its calls.
 *
 * @param shellPath PATH the pretend login shell reports.
 * @returns Runner and the list of shells it was asked to run.
 */
function shellRunnerCreate(shellPath: string): { runner: GameProcessShellRunner; shellsRun: string[] } {
  const shellsRun: string[] = [];
  const runner: GameProcessShellRunner = (shell) => {
    shellsRun.push(shell);
    return `Welcome back!\n${GAME_PROCESS_SHELL_PATH_MARKER}${shellPath}\n`;
  };
  return { runner, shellsRun };
}

/**
 * Joins directories into one PATH value.
 *
 * @param directories Directories in order.
 * @returns PATH value.
 */
function pathJoin(...directories: string[]): string {
  return directories.join(delimiter);
}

/**
 * Programs of a game project start with the PATH of the user's login shell, so
 * an app opened from the Finder finds programs installed for the user.
 */
describe('GameProcessEnvironmentShellPath', () => {
  it('puts the login shell PATH first and keeps the remaining app directories once', () => {
    const appPath = pathJoin('/usr/bin', '/bin');
    const shellPath = pathJoin('/home/player/.bun/bin', '/usr/bin');
    const { runner, shellsRun } = shellRunnerCreate(shellPath);
    const appEnvironment = { PATH: appPath, SHELL: '/bin/zsh', GAME_SETTING: 'kept' };
    const environment = new GameProcessEnvironmentShellPath(appEnvironment, 'darwin', runner).environmentRead();
    expect(environment['PATH']).toBe(pathJoin('/home/player/.bun/bin', '/usr/bin', '/bin'));
    expect(environment['GAME_SETTING']).toBe('kept');
    expect(shellsRun).toEqual(['/bin/zsh']);
  });

  it('asks the login shell only once', () => {
    const { runner, shellsRun } = shellRunnerCreate('/opt/tools');
    const builder = new GameProcessEnvironmentShellPath({ PATH: '/usr/bin' }, 'linux', runner);
    builder.environmentRead();
    builder.environmentRead();
    expect(shellsRun.length).toBe(1);
  });

  it('keeps the app PATH when the shell fails or on Windows', () => {
    const failingRunner: GameProcessShellRunner = () => null;
    const appEnvironment = { PATH: '/usr/bin' };
    const failed = new GameProcessEnvironmentShellPath(appEnvironment, 'darwin', failingRunner).environmentRead();
    const { runner, shellsRun } = shellRunnerCreate('/opt/tools');
    const windows = new GameProcessEnvironmentShellPath(appEnvironment, 'win32', runner).environmentRead();
    expect(failed['PATH']).toBe('/usr/bin');
    expect(windows['PATH']).toBe('/usr/bin');
    expect(shellsRun).toEqual([]);
  });
});
