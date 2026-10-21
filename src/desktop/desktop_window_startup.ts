/** Browser surface lifecycle used during desktop startup. */
export type ReadyDesktopWebview = {
  on(name: 'dom-ready', handler: () => void): unknown;
};

/** Native window operations used during desktop startup. */
export type StartupDesktopWindow = {
  webview: ReadyDesktopWebview;
  maximize(): unknown;
  show(): unknown;
};

/**
 * Optional work to run once the window is ready, after it was maximized and
 * shown.
 */
export type AfterDesktopWindowShown = () => void | Promise<void>;

/** Environment variable that keeps the desktop window hidden when set to 1. */
export const DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY = 'BEVYBROOM_DESKTOP_HIDDEN';

/**
 * Reads whether the environment asks for the desktop window to stay hidden.
 *
 * @param environment Process environment.
 * @returns True when the window must never be shown.
 */
export function desktopWindowHiddenRequested(environment: Record<string, string | undefined>): boolean {
  return environment[DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY] === '1';
}

/**
 * Shows a maximized window after its webview can process resize events. A
 * window kept hidden is never shown, but the callback still runs once the
 * webview is ready.
 *
 * @param desktopWindow Native window hosting the editor.
 * @param afterShown Optional callback after maximize/show (for HWND icons).
 * @param isKeptHidden Leaves the window hidden instead of showing it.
 */
export function showMaximizedWhenReady(
  desktopWindow: StartupDesktopWindow,
  afterShown?: AfterDesktopWindowShown,
  isKeptHidden: boolean = false,
): void {
  desktopWindow.webview.on('dom-ready', () => {
    if (!isKeptHidden) {
      desktopWindow.maximize();
      desktopWindow.show();
    }
    void afterShown?.();
  });
}
