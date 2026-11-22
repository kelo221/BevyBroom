import type { GameProcessStatus } from '@/project/process/game_process_types.js';

/**
 * Creates the status of an editor without an open project and without a game.
 *
 * @param message What the status tells the user.
 * @returns Idle status without project, process, log or command.
 */
export function gameProcessStatusEmptyCreate(message: string): GameProcessStatus {
  return {
    project: null,
    phase: 'idle',
    processId: null,
    exitCode: null,
    diagnostics: [],
    gameNotices: [],
    logTail: [],
    message,
    generation: 0,
    isBusy: false,
    command: null,
  };
}
