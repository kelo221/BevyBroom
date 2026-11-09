import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import type {
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Explanation shown where only the desktop app can manage a game. */
export const GAME_PROCESS_DESKTOP_ONLY_MESSAGE =
  'Opening projects and starting games needs the desktop app. In the browser, start the game yourself and connect to it in the Game Preview panel.';

/**
 * Opens game projects and drives the game the editor manages. The desktop app
 * can start local processes; the browser editor can only attach to a running
 * game.
 */
export abstract class GameProcessControl {
  /** True when this editor can open projects and manage game processes. */
  abstract readonly isAvailable: boolean;

  /**
   * Asks the user for a project file.
   *
   * @returns Chosen path, or null when cancelled.
   */
  abstract projectChooseFile(): Promise<string | null>;

  /**
   * Opens a project file.
   *
   * @param projectFile Absolute path of broom.project.json.
   * @returns New status, or why the project cannot be opened.
   */
  abstract projectOpen(projectFile: string): Promise<ProjectOpenResult>;

  /**
   * Starts an action on the managed game.
   *
   * @param action Action to start.
   * @returns Status right after the action was scheduled.
   */
  abstract actionStart(action: GameProcessAction): Promise<GameProcessStatus>;

  /**
   * Reads the status of the managed game.
   *
   * @returns Status snapshot.
   */
  abstract statusRead(): Promise<GameProcessStatus>;

  /**
   * Writes a built level into the open project's level directory.
   *
   * @param request Geometry and manifest to publish.
   * @returns Where the package went, or why nothing was written.
   */
  abstract levelPackagePublish(request: LevelBuildPublishRequest): Promise<LevelBuildPublishResult>;

  /**
   * Lists the images of the open project's texture directories.
   *
   * @returns Image paths relative to the asset root, or why there are none.
   */
  abstract projectTextureList(): Promise<TextureProjectListResult>;

  /**
   * Reads one image of the open project's texture directories.
   *
   * @param path Image path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  abstract projectTextureRead(path: string): Promise<TextureProjectReadResult>;

  /**
   * Reads every sprinkle definition file of the open project's sprinkle
   * directories.
   *
   * @returns The files, or why there are none.
   */
  abstract projectSprinkleDefinitionFilesRead(): Promise<SprinkleDefinitionFilesReadResult>;

  /**
   * Opens one sprinkle definition file of the open project in the system's text
   * editor.
   *
   * @param path File path relative to the asset root.
   * @returns Success, or why the file was not opened.
   */
  abstract projectSprinkleDefinitionOpen(path: string): Promise<SprinkleDefinitionOpenResult>;
}

/**
 * Control of an editor that cannot manage processes, such as the browser
 * editor.
 */
export class GameProcessControlUnavailable extends GameProcessControl {
  readonly isAvailable = false;

  /**
   * Returns no file because nothing can be opened.
   *
   * @returns Null.
   */
  async projectChooseFile(): Promise<string | null> {
    return null;
  }

  /**
   * Explains that projects need the desktop app.
   *
   * @returns Failure result.
   */
  async projectOpen(): Promise<ProjectOpenResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Explains that games need the desktop app.
   *
   * @returns Idle status with the explanation.
   */
  async actionStart(): Promise<GameProcessStatus> {
    return this.statusUnavailableCreate();
  }

  /**
   * Returns the idle status.
   *
   * @returns Idle status with the explanation.
   */
  async statusRead(): Promise<GameProcessStatus> {
    return this.statusUnavailableCreate();
  }

  /**
   * Explains that writing level packages needs the desktop app.
   *
   * @returns Failure result.
   */
  async levelPackagePublish(): Promise<LevelBuildPublishResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Explains that project textures need the desktop app.
   *
   * @returns Failure result.
   */
  async projectTextureList(): Promise<TextureProjectListResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Explains that project textures need the desktop app.
   *
   * @returns Failure result.
   */
  async projectTextureRead(): Promise<TextureProjectReadResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Explains that project sprinkle definitions need the desktop app.
   *
   * @returns Failure result.
   */
  async projectSprinkleDefinitionFilesRead(): Promise<SprinkleDefinitionFilesReadResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Explains that opening sprinkle definition files needs the desktop app.
   *
   * @returns Failure result.
   */
  async projectSprinkleDefinitionOpen(): Promise<SprinkleDefinitionOpenResult> {
    return { ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE };
  }

  /**
   * Builds the status of an editor without process control.
   *
   * @returns Idle status.
   */
  private statusUnavailableCreate(): GameProcessStatus {
    return {
      project: null,
      phase: 'idle',
      processId: null,
      exitCode: null,
      diagnostics: [],
      logTail: [],
      message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE,
      generation: 0,
    };
  }
}
