import { WindowContextMenuSuppressSession } from '@/utils/session_window_context_menu_suppress.js';

/** Mouse button index of the secondary (right) button. */
const EDITOR_INPUT_SECONDARY_BUTTON = 2;

/**
 * Tracks a right-button press that began over a viewport and blocks the browser
 * context menu of its window until just after the release.
 */
export class EditorInputSecondaryPressGuard {
  private readonly contextMenuSuppressSession: WindowContextMenuSuppressSession;
  private isSecondaryPressHeld: boolean;

  /** Creates a guard with no press held. */
  constructor() {
    this.contextMenuSuppressSession = new WindowContextMenuSuppressSession();
    this.isSecondaryPressHeld = false;
  }

  /**
   * Starts guarding a viewport press when it is a right-button press.
   *
   * @param button Mouse button index of the press.
   * @param ownerWindow Window that owns the press, or null when unknown.
   */
  pressBegin(button: number, ownerWindow: Window | null): void {
    if (button !== EDITOR_INPUT_SECONDARY_BUTTON) {
      return;
    }
    this.isSecondaryPressHeld = true;
    if (ownerWindow) {
      this.contextMenuSuppressSession.install(ownerWindow);
    }
  }

  /**
   * Returns whether a guarded right-button press is held.
   *
   * @returns True between a guarded press and its release.
   */
  isHeld(): boolean {
    return this.isSecondaryPressHeld;
  }

  /**
   * Ends the guarded press at a right-button release and lets the context menu
   * suppression lapse after the release's own menu event.
   *
   * @param button Mouse button index of the release.
   */
  releaseObserve(button: number): void {
    if (button !== EDITOR_INPUT_SECONDARY_BUTTON) {
      return;
    }
    this.isSecondaryPressHeld = false;
    this.contextMenuSuppressSession.removeAfterRelease();
  }

  /** Forgets the held press and stops blocking the context menu right away. */
  dispose(): void {
    this.isSecondaryPressHeld = false;
    this.contextMenuSuppressSession.remove();
  }
}
