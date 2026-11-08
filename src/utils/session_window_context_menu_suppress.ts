/**
 * Blocks the browser context menu of one window with a capture-phase
 * `contextmenu` listener for the length of a pointer press. Removal can be
 * deferred by one task so the context menu event that follows the release still
 * gets blocked; a newer install voids an older pending removal.
 */
export class WindowContextMenuSuppressSession {
  private readonly contextMenuPreventListener: (event: Event) => void;
  private suppressedWindow: Window | null;
  private installGeneration: number;

  /** Creates a session that suppresses nothing yet. */
  constructor() {
    this.contextMenuPreventListener = (event) => event.preventDefault();
    this.suppressedWindow = null;
    this.installGeneration = 0;
  }

  /**
   * Starts suppressing the context menu of a window, replacing any window
   * suppressed before.
   *
   * @param ownerWindow Window whose context menu is blocked.
   */
  install(ownerWindow: Window): void {
    this.remove();
    this.installGeneration += 1;
    this.suppressedWindow = ownerWindow;
    ownerWindow.addEventListener('contextmenu', this.contextMenuPreventListener, true);
  }

  /**
   * Returns whether a window's context menu is currently suppressed.
   *
   * @returns True while the listener is attached.
   */
  isInstalled(): boolean {
    return this.suppressedWindow !== null;
  }

  /**
   * Stops suppressing after the current task, so a context menu event raised by
   * the same release is still blocked. Does nothing when a new install happens
   * before the deferred removal runs.
   */
  removeAfterRelease(): void {
    const ownerWindow = this.suppressedWindow;
    if (!ownerWindow) {
      return;
    }
    const generationAtRelease = this.installGeneration;
    ownerWindow.setTimeout(() => this.removeIfGenerationUnchanged(generationAtRelease), 0);
  }

  /** Stops suppressing the context menu right away. */
  remove(): void {
    this.suppressedWindow?.removeEventListener('contextmenu', this.contextMenuPreventListener, true);
    this.suppressedWindow = null;
  }

  /**
   * Removes the suppression when no install happened since a release.
   *
   * @param generationAtRelease Install generation read at the release.
   */
  private removeIfGenerationUnchanged(generationAtRelease: number): void {
    if (this.installGeneration !== generationAtRelease) {
      return;
    }
    this.remove();
  }
}
