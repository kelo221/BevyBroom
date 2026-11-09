import * as THREE from 'three';
import type { ManagerInput } from '@/input/manager_input.js';
import type { EditorWindow } from '@/editor/window/editor_window.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { PlayerCollisionWorld } from './collision/player_collision_world.js';
import { PlayerPlaySession } from './session/player_play_session.js';
import { PlayerPlayTool } from './tool/player_play_tool.js';
import { playerCharacterEnsureModelLoaded } from './character/player_character_model_loader.js';

/** Host surface used to wire the player system into the editor layout. */
export interface PlayerSystemHost {
  worldRoot: THREE.Object3D;
  inputManager: ManagerInput;
  getEditorWindow: () => EditorWindow | null;
  getPerspectiveViewports: () => readonly Viewport3D[];
  showStatusMessage: (message: string) => void;
}

/**
 * Self-contained play-mode system: Play command and Play from here enter, ESC
 * exit.
 */
export class PlayerSystem {
  private readonly host: PlayerSystemHost;
  private readonly collisionWorld: PlayerCollisionWorld;
  private readonly session: PlayerPlaySession;
  private readonly playTool: PlayerPlayTool;
  private readonly playFromHereViewports: Viewport3D[];
  private isDisposed: boolean;

  /**
   * Creates the player system and offers Play from here on perspective
   * viewports.
   *
   * @param host Layout host dependencies.
   */
  constructor(host: PlayerSystemHost) {
    this.host = host;
    this.collisionWorld = new PlayerCollisionWorld();
    this.collisionWorld.setWorldRoot(host.worldRoot);
    this.session = new PlayerPlaySession({
      inputManager: host.inputManager,
      worldRoot: host.worldRoot,
      collisionWorld: this.collisionWorld,
      getPerspectiveViewports: () => host.getPerspectiveViewports(),
      showStatusMessage: (message) => host.showStatusMessage(message),
    });
    this.playTool = new PlayerPlayTool(this.session);
    this.playFromHereViewports = [];
    this.isDisposed = false;
    this.playFromHereInstall();
    void playerCharacterEnsureModelLoaded();
  }

  /**
   * Starts play mode from the Play command when the editor is idle.
   *
   * @returns True when play mode started.
   */
  playModeStart(): boolean {
    if (this.isDisposed || this.session.getIsActive()) {
      return false;
    }
    return this.playModeBegin(() => this.session.tryEnter());
  }

  /**
   * Starts play mode in one perspective viewport from its camera when the
   * editor is idle.
   *
   * @param viewport Perspective viewport to play in.
   * @returns True when play mode started.
   */
  playModeStartFromViewport(viewport: Viewport3D): boolean {
    if (this.isDisposed || this.session.getIsActive()) {
      return false;
    }
    return this.playModeBegin(() => this.session.tryEnterOnViewport(viewport));
  }

  /** Offers Play from here again after viewport kind changes or detach. */
  refreshViewportChrome(): void {
    if (this.isDisposed) {
      return;
    }
    this.playFromHereInstall();
  }

  /**
   * Returns whether play mode is active.
   *
   * @returns True while playing.
   */
  getIsPlaying(): boolean {
    return this.session.getIsActive();
  }

  /** Removes Play from here and ends active play mode. */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    if (this.session.getIsActive()) {
      this.session.exit();
    }
    this.session.dispose();
    this.playFromHereRemove();
  }

  /**
   * Enters the play session as a single-use exclusive tool.
   *
   * @param sessionEnter Enters the session and returns whether it started.
   * @returns True when play mode started.
   */
  private playModeBegin(sessionEnter: () => boolean): boolean {
    const editorWindow = this.host.getEditorWindow();
    if (!editorWindow) {
      return false;
    }
    if (editorWindow.activeTool?.isBusy()) {
      return false;
    }
    if (!sessionEnter()) {
      return false;
    }
    editorWindow.useTool(this.playTool);
    return true;
  }

  /** Registers Play from here on the view menu of every perspective viewport. */
  private playFromHereInstall(): void {
    this.playFromHereRemove();
    const viewports = this.host.getPerspectiveViewports();
    for (let index = 0; index < viewports.length; index++) {
      const viewport = viewports[index];
      if (!viewport) {
        continue;
      }
      viewport.getViewportToolbar().setOnPlayFromHere(() => this.playModeStartFromViewport(viewport));
      this.playFromHereViewports.push(viewport);
    }
  }

  /** Removes Play from here from the view menus it was registered on. */
  private playFromHereRemove(): void {
    for (let index = 0; index < this.playFromHereViewports.length; index++) {
      this.playFromHereViewports[index]?.getViewportToolbar().setOnPlayFromHere(null);
    }
    this.playFromHereViewports.length = 0;
  }
}
