import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';
import { GameProcessSpawner, type GameProcessHandle } from '@/desktop/bun/game_process/game_process_spawner.js';

/** One program the fake started. */
export interface GameProcessFakeRun {
  command: PreviewLaunchCommand;
  handle: GameProcessHandle;
  isTerminated: boolean;
  /** Ends the program on its own with an exit code. */
  exit(code: number): void;
}

/**
 * Pretends to start programs. Commands whose first argument is `build` end at
 * once with {@link buildExitCode} after printing {@link buildOutput}; others run
 * until they are terminated or exited.
 */
export class GameProcessSpawnerFake extends GameProcessSpawner {
  readonly runs: GameProcessFakeRun[] = [];
  buildExitCode = 0;
  buildOutput: string[] = [];
  private nextProcessId = 100;

  /**
   * Starts a pretend program.
   *
   * @param command Command to start.
   * @param onOutputLine Receives the printed lines.
   * @returns Pretend handle.
   */
  spawn(command: PreviewLaunchCommand, onOutputLine: (line: string) => void): GameProcessHandle {
    let resolveExit: (code: number) => void = () => {};
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const run = this.runCreate(command, exited, resolveExit);
    this.runs.push(run);
    if (command.arguments[0] === 'build') {
      this.buildOutput.forEach(onOutputLine);
      run.exit(this.buildExitCode);
    }
    return run.handle;
  }

  /**
   * Returns the started programs that are still running.
   *
   * @returns Running pretend programs.
   */
  runningRuns(): GameProcessFakeRun[] {
    return this.runs.filter((run) => !run.isTerminated);
  }

  /**
   * Builds the record of one pretend program.
   *
   * @param command Started command.
   * @param exited Exit promise.
   * @param resolveExit Settles the exit promise.
   * @returns Run record.
   */
  private runCreate(
    command: PreviewLaunchCommand,
    exited: Promise<number>,
    resolveExit: (code: number) => void,
  ): GameProcessFakeRun {
    const run: GameProcessFakeRun = {
      command,
      isTerminated: false,
      exit: (code) => {
        run.isTerminated = true;
        resolveExit(code);
      },
      handle: {
        processId: this.nextProcessId++,
        exited,
        terminate: async () => {
          run.exit(1);
          await exited;
        },
        terminateNow: () => run.exit(1),
      },
    };
    return run;
  }
}
