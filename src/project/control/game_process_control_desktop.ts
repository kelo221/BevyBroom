import type { ElectrobunDesktopBunRpcClient } from '@/ai/shared/mcp_rpc_schema.js';
import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import { GameProcessControl, GameProcessControlUnavailable } from '@/project/control/game_process_control.js';

declare global {
  interface Window {
    bevybroomGameProcessControl?: GameProcessControl;
  }
}

/** Control of the desktop app: requests go to its main process. */
export class GameProcessControlDesktop extends GameProcessControl {
  readonly isAvailable = true;
  private readonly rpc: ElectrobunDesktopBunRpcClient;

  /**
   * Creates the control.
   *
   * @param rpc Requests of the desktop main process.
   */
  constructor(rpc: ElectrobunDesktopBunRpcClient) {
    super();
    this.rpc = rpc;
  }

  /**
   * Shows the native file dialog.
   *
   * @returns Chosen path, or null when cancelled.
   */
  projectChooseFile(): Promise<string | null> {
    return this.rpc.request.projectChooseFile();
  }

  /**
   * Opens a project in the main process.
   *
   * @param projectFile Absolute path of broom.project.json.
   * @returns New status, or why the project cannot be opened.
   */
  projectOpen(projectFile: string): Promise<ProjectOpenResult> {
    return this.rpc.request.projectOpen({ projectFile });
  }

  /**
   * Starts an action in the main process.
   *
   * @param action Action to start.
   * @returns Status right after the action was scheduled.
   */
  actionStart(action: GameProcessAction): Promise<GameProcessStatus> {
    return this.rpc.request.gameProcessAction({ action });
  }

  /**
   * Reads the status from the main process.
   *
   * @returns Status snapshot.
   */
  statusRead(): Promise<GameProcessStatus> {
    return this.rpc.request.gameProcessStatus();
  }
}

/**
 * Returns the control installed by the desktop app, or one that explains that
 * only the desktop app manages games.
 *
 * @returns Process control of this editor.
 */
export function gameProcessControlResolve(): GameProcessControl {
  const installed = typeof window === 'undefined' ? undefined : window.bevybroomGameProcessControl;
  return installed ?? new GameProcessControlUnavailable();
}
