import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';

/** Desktop requests that open projects and drive the managed game. */
export interface GameProcessRpcHandlers {
  projectChooseFile: () => Promise<string | null>;
  projectOpen: (params: { projectFile: string }) => Promise<ProjectOpenResult>;
  gameProcessAction: (params: { action: GameProcessAction }) => GameProcessStatus;
  gameProcessStatus: () => GameProcessStatus;
}

/**
 * Creates the request handlers of the game process host.
 *
 * @param host Host that owns the managed game.
 * @param fileChoose Shows a native file dialog and returns the chosen paths.
 * @returns Request handlers keyed by request name.
 */
export function gameProcessRpcHandlersCreate(
  host: GameProcessHost,
  fileChoose: () => Promise<string[]>,
): GameProcessRpcHandlers {
  return {
    projectChooseFile: async () => (await fileChoose()).find((path) => path.trim() !== '') ?? null,
    projectOpen: ({ projectFile }) => host.projectOpen(projectFile),
    gameProcessAction: ({ action }) => host.actionStart(action),
    gameProcessStatus: () => host.statusRead(),
  };
}
