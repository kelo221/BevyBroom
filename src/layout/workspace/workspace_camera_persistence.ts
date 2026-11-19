import { areEditorStorageWritesSuppressed } from '@/settings/storage/clear_editor_storage.js';

/**
 * Quiet time after the last camera input before the workspace is saved, in
 * milliseconds.
 */
export const WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS = 500;

/** Input events on the viewport area that may have moved a camera. */
const WORKSPACE_CAMERA_AREA_EVENTS = ['pointerup', 'wheel'] as const;

/** Window events after which a camera may have moved or the app may close. */
const WORKSPACE_CAMERA_WINDOW_EVENTS = ['keyup', 'blur', 'pagehide', 'beforeunload'] as const;

/** Where camera input happens and what saving the workspace does. */
export interface WorkspaceCameraPersistenceHost {
  /**
   * Element holding the viewports; pointer and wheel input there may move
   * cameras.
   */
  readonly viewportArea: HTMLElement;
  /** Window whose keyboard, focus and unload events are followed. */
  readonly windowObject: Window;
  /** Saves the current layout with its live camera poses. */
  persist(): void;
}

/**
 * Saves the active workspace with its camera poses shortly after the cameras
 * stop moving, and when the window loses focus or closes, so the editor reopens
 * with the same views even when the app quits without unload events.
 */
export class WorkspaceCameraPersistence {
  private readonly host: WorkspaceCameraPersistenceHost;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private readonly onCameraInput = (): void => this.persistSchedule();
  private readonly onWindowEvent = (event: Event): void => this.windowEventHandle(event);

  /**
   * Starts following camera input.
   *
   * @param host Viewport area, window and the save step.
   */
  constructor(host: WorkspaceCameraPersistenceHost) {
    this.host = host;
    WORKSPACE_CAMERA_AREA_EVENTS.forEach((name) => host.viewportArea.addEventListener(name, this.onCameraInput));
    WORKSPACE_CAMERA_WINDOW_EVENTS.forEach((name) => host.windowObject.addEventListener(name, this.onWindowEvent));
  }

  /** Stops following input and drops a pending save. */
  dispose(): void {
    this.timerCancel();
    WORKSPACE_CAMERA_AREA_EVENTS.forEach((name) =>
      this.host.viewportArea.removeEventListener(name, this.onCameraInput),
    );
    WORKSPACE_CAMERA_WINDOW_EVENTS.forEach((name) =>
      this.host.windowObject.removeEventListener(name, this.onWindowEvent),
    );
  }

  /**
   * Saves at once when the window loses focus or closes, otherwise after the
   * quiet time.
   *
   * @param event Window event.
   */
  private windowEventHandle(event: Event): void {
    if (event.type === 'keyup') {
      this.persistSchedule();
      return;
    }
    this.persistNow();
  }

  /** Restarts the quiet-time timer that saves the workspace. */
  private persistSchedule(): void {
    this.timerCancel();
    this.timerId = setTimeout(() => this.persistNow(), WORKSPACE_CAMERA_PERSISTENCE_DELAY_MS);
  }

  /** Saves the workspace unless storage writes are switched off. */
  private persistNow(): void {
    this.timerCancel();
    if (!areEditorStorageWritesSuppressed()) {
      this.host.persist();
    }
  }

  /** Drops the pending save. */
  private timerCancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
