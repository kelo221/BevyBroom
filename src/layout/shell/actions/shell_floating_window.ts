/** Ids of the floating windows the main window menus open and close. */
export const SHELL_FLOATING_WINDOW_IDS = ['texture_browser', 'entity_browser'] as const;

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
}
