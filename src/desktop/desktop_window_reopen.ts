/** Native window operations used when the app is reopened from the Dock. */
export interface ReopenDesktopWindow {
  /**
   * Returns whether the window sits minimized in the Dock.
   *
   * @returns True while minimized.
   */
  isMinimized(): boolean;
  /** Restores a minimized window. */
  unminimize(): void;
  /** Shows the window and brings it to the front. */
  show(): void;
}

/** What a Dock reopen did to the window. */
export type DesktopWindowReopenOutcome = 'kept_hidden' | 'unminimized' | 'shown';

/**
 * Brings the main window back when the user clicks the Dock icon while it is
 * hidden or minimized. A window the launch keeps hidden stays hidden so
 * automated runs never show it.
 *
 * @param desktopWindow Native window hosting the editor.
 * @param isKeptHidden Whether the launch asked for the window to stay hidden.
 * @returns What happened to the window.
 */
export function desktopWindowReopenHandle(
  desktopWindow: ReopenDesktopWindow,
  isKeptHidden: boolean,
): DesktopWindowReopenOutcome {
  if (isKeptHidden) {
    return 'kept_hidden';
  }
  if (desktopWindow.isMinimized()) {
    desktopWindow.unminimize();
    desktopWindow.show();
    return 'unminimized';
  }
  desktopWindow.show();
  return 'shown';
}
