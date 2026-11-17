import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { GameProcessSpawnerNode } from '@/desktop/bun/game_process/game_process_spawner_node.js';
import {
  GAME_PROCESS_SHELL_PATH_MARKER,
  GameProcessEnvironmentShellPath,
} from '@/desktop/bun/game_process/game_process_environment_shell_path.js';

/** Temporary directories created by the tests, removed afterwards. */
const temporaryDirectories: string[] = [];

/**
 * Creates a temporary directory whose name has spaces and non-ASCII letters.
 *
 * @returns Absolute directory.
 */
function directoryWithSpacesCreate(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'broom spawner ü ')));
  temporaryDirectories.push(directory);
  return directory;
}

/**
 * Real programs are started, their output is read and they are ended with their
 * children.
 */
describe('GameProcessSpawnerNode', () => {
  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  });

  it('runs a program in a directory with spaces and forwards its output lines and exit code', async () => {
    const workingDirectory = directoryWithSpacesCreate();
    const lines: string[] = [];
    const handle = new GameProcessSpawnerNode().spawn(
      {
        program: process.execPath,
        arguments: ['-e', 'console.log("first"); console.error(process.cwd()); process.exit(7)'],
        workingDirectory,
        endpoint: '',
      },
      (line) => lines.push(line),
    );
    expect(await handle.exited).toBe(7);
    expect(lines).toContain('first');
    expect(lines).toContain(workingDirectory);
  });

  it('ends a program that keeps running', async () => {
    const handle = new GameProcessSpawnerNode().spawn(
      {
        program: process.execPath,
        arguments: ['-e', 'setInterval(() => {}, 1000)'],
        workingDirectory: tmpdir(),
        endpoint: '',
      },
      () => {},
    );
    expect(handle.processId).toBeGreaterThan(0);
    await handle.terminate();
    expect(typeof (await handle.exited)).toBe('number');
  });

  it.skipIf(process.platform === 'win32')(
    'finds a program by name in a directory only the login shell PATH lists',
    async () => {
      const toolDirectory = directoryWithSpacesCreate();
      const toolName = `broom-test-tool-${process.pid}`;
      writeFileSync(join(toolDirectory, toolName), '#!/bin/sh\necho "tool ran"\n');
      chmodSync(join(toolDirectory, toolName), 0o755);
      const shellPath = [toolDirectory, process.env['PATH'] ?? ''].join(delimiter);
      const environment = new GameProcessEnvironmentShellPath(
        { PATH: '/usr/bin:/bin' },
        process.platform,
        () => `${GAME_PROCESS_SHELL_PATH_MARKER}${shellPath}`,
      );
      const lines: string[] = [];
      const handle = new GameProcessSpawnerNode(environment).spawn(
        { program: toolName, arguments: [], workingDirectory: toolDirectory, endpoint: '' },
        (line) => lines.push(line),
      );
      expect(await handle.exited).toBe(0);
      expect(lines).toContain('tool ran');
    },
  );

  it('reports a program that cannot be started as exit code -1 with a reason', async () => {
    const lines: string[] = [];
    const handle = new GameProcessSpawnerNode().spawn(
      { program: join(tmpdir(), 'no such program here'), arguments: [], workingDirectory: tmpdir(), endpoint: '' },
      (line) => lines.push(line),
    );
    expect(await handle.exited).toBe(-1);
    expect(lines.join('\n')).toContain('could not start');
  });
});
