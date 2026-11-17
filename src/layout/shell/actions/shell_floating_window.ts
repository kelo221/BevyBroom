/** Ids of the floating windows the main window menus open and close. */
export const SHELL_FLOATING_WINDOW_IDS = ['texture_browser', 'entity_browser', 'level_browser'] as const;

/** Ids of the floating windows the main window menus open and close. */
export type ShellFloatingWindowId = (typeof SHELL_FLOATING_WINDOW_IDS)[number];

/** Floating window the main window menus open and close. */
export interface ShellFloatingWindow {
  /** Shows the window when hidden and hides it when shown. */
  toggle(): void;
  /**
   * Returns whether the window is shown.
   *
   * @returns True while shown.
   */
  isOpen(): boolean;
  /**
   * Registers a callback run whenever the window opens or closes.
   *
   * @param listener Receives whether the window is open now.
   * @returns Function that removes the callback.
   */
  openChangeListenerAdd?(listener: (isOpen: boolean) => void): () => void;
}

/**
 * Receives that a registered floating window opened or closed.
 *
 * @param windowId Floating window id.
 * @param isOpen Whether the window is open now.
 */
export type ShellFloatingWindowOpenChangeListener = (windowId: ShellFloatingWindowId, isOpen: boolean) => void;
