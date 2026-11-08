import type { ElectrobunDesktopBunRpcClient } from '@/ai/shared/mcp_rpc_schema.js';
import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import { GameProcessControl, GameProcessControlUnavailable } from '@/project/control/game_process_control.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import type {
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';

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

  /**
   * Asks the main process to write a built level into the open project.
   *
   * @param request Geometry and manifest to publish.
   * @returns Where the package went, or why nothing was written.
   */
  levelPackagePublish(request: LevelBuildPublishRequest): Promise<LevelBuildPublishResult> {
    return this.rpc.request.levelPackagePublish(request);
  }

  /**
   * Asks the main process for the images of the open project's texture
   * directories.
   *
   * @returns Image paths relative to the asset root, or why there are none.
   */
  projectTextureList(): Promise<TextureProjectListResult> {
    return this.rpc.request.projectTextureList();
  }

  /**
   * Asks the main process for the bytes of one project image.
   *
   * @param path Image path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  projectTextureRead(path: string): Promise<TextureProjectReadResult> {
    return this.rpc.request.projectTextureRead({ path });
  }

  /**
   * Asks the main process for every sprinkle definition file of the open
   * project.
   *
   * @returns The files, or why there are none.
   */
  projectSprinkleDefinitionFilesRead(): Promise<SprinkleDefinitionFilesReadResult> {
    return this.rpc.request.projectSprinkleDefinitionFilesRead();
  }

  /**
   * Asks the main process to open one sprinkle definition file in the system's
   * text editor.
   *
   * @param path File path relative to the asset root.
   * @returns Success, or why the file was not opened.
   */
  projectSprinkleDefinitionOpen(path: string): Promise<SprinkleDefinitionOpenResult> {
    return this.rpc.request.projectSprinkleDefinitionOpen({ path });
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
