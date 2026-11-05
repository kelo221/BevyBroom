/** Ids of the floating windows the main window menus open and close. */
export type ShellFloatingWindowId = 'texture_browser' | 'entity_browser';

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
}
