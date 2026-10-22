import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';
import { GameProcessSpawner, type GameProcessHandle } from '@/desktop/bun/game_process/game_process_spawner.js';

/**
 * Starts programs as operating system processes and ends them together with
 * every process they started, which `cargo run` needs.
 */
export class GameProcessSpawnerNode extends GameProcessSpawner {
  /**
   * Starts a command without a shell, so paths with spaces need no quoting.
   *
   * @param command Program, arguments and working directory.
   * @param onOutputLine Receives every line the program prints.
   * @returns The started program.
   */
  spawn(command: PreviewLaunchCommand, onOutputLine: (line: string) => void): GameProcessHandle {
    const child = spawn(command.program, command.arguments, {
      cwd: command.workingDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      windowsHide: true,
    });
    const exited = GameProcessSpawnerNode.exitedPromise(child);
    GameProcessSpawnerNode.outputLinesForward(child, onOutputLine);
    const processId = child.pid ?? 0;
    return {
      processId,
      exited,
      terminate: () => GameProcessSpawnerNode.treeTerminate(child, exited),
      terminateNow: () => GameProcessSpawnerNode.treeTerminateNow(child),
    };
  }

  /**
   * Ends a process and its children synchronously.
   *
   * @param child Started process.
   */
  private static treeTerminateNow(child: ChildProcess): void {
    if (child.exitCode !== null || child.pid === undefined) {
      return;
    }
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      GameProcessSpawnerNode.processGroupKill(child.pid);
    }
  }

  /**
   * Returns a promise for the exit code; a program that failed to start counts
   * as exit code -1 after its error is reported.
   *
   * @param child Started process.
   * @returns Exit code promise.
   */
  private static exitedPromise(child: ChildProcess): Promise<number> {
    return new Promise((resolve) => {
      child.once('error', () => resolve(-1));
      child.once('exit', (code) => resolve(code ?? -1));
    });
  }

  /**
   * Splits stdout and stderr into lines.
   *
   * @param child Started process.
   * @param onOutputLine Receives every line.
   */
  private static outputLinesForward(child: ChildProcess, onOutputLine: (line: string) => void): void {
    for (const stream of [child.stdout, child.stderr]) {
      let pending = '';
      stream?.setEncoding('utf8');
      stream?.on('data', (chunk: string) => {
        const lines = (pending + chunk).split(/\r?\n/);
        pending = lines.pop() ?? '';
        lines.forEach(onOutputLine);
      });
      stream?.on('end', () => pending !== '' && onOutputLine(pending));
    }
    child.once('error', (error) => onOutputLine(`could not start: ${error.message}`));
  }

  /**
   * Ends a process and its children and waits until it exited.
   *
   * @param child Started process.
   * @param exited Exit code promise of the process.
   */
  private static async treeTerminate(child: ChildProcess, exited: Promise<number>): Promise<void> {
    if (child.exitCode !== null || child.pid === undefined) {
      return;
    }
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      await once(killer, 'exit').catch(() => undefined);
    } else {
      GameProcessSpawnerNode.processGroupKill(child.pid);
    }
    await exited;
  }

  /**
   * Ends a process group started detached.
   *
   * @param processId Process id leading the group.
   */
  private static processGroupKill(processId: number): void {
    try {
      process.kill(-processId, 'SIGTERM');
    } catch {
      process.kill(processId, 'SIGTERM');
    }
  }
}
