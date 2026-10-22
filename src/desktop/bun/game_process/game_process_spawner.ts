import type { PreviewLaunchCommand } from '@/preview/launch/preview_launch_command.js';

/** A started program. */
export interface GameProcessHandle {
  /** Operating system process id. */
  readonly processId: number;
  /** Settles with the exit code once the program ended. */
  readonly exited: Promise<number>;
  /** Ends the program and every program it started. */
  terminate(): Promise<void>;
  /**
   * Ends the program and every program it started without waiting, for use
   * while the editor exits.
   */
  terminateNow(): void;
}

/** Starts programs and streams their output lines. */
export abstract class GameProcessSpawner {
  /**
   * Starts a command.
   *
   * @param command Program, arguments and working directory.
   * @param onOutputLine Receives every line the program prints.
   * @returns The started program.
   * @throws Error when the program cannot be started.
   */
  abstract spawn(command: PreviewLaunchCommand, onOutputLine: (line: string) => void): GameProcessHandle;
}
