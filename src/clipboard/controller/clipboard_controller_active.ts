import type { ControllerClipboard } from '@/clipboard/controller/controller_clipboard.js';

/** Holds the clipboard controller of the open main window. */
class ClipboardControllerActiveSlot {
  private controller: ControllerClipboard | null = null;

  /**
   * Returns the clipboard controller of the open main window.
   *
   * @returns Controller, or null when no main window clipboard exists.
   */
  controllerRead(): ControllerClipboard | null {
    return this.controller;
  }

  /**
   * Stores or clears the clipboard controller of the open main window.
   *
   * @param controller Controller to store, or null to clear.
   */
  controllerWrite(controller: ControllerClipboard | null): void {
    this.controller = controller;
  }

  /**
   * Clears the stored controller when it is the given one.
   *
   * @param controller Controller that is going away.
   */
  controllerReleaseIfStored(controller: ControllerClipboard): void {
    if (this.controller === controller) {
      this.controller = null;
    }
  }
}

/** Main window clipboard controller the MCP clipboard tools paste through. */
export const clipboardControllerActive = new ClipboardControllerActiveSlot();
