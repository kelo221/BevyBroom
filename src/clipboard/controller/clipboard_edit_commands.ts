import type { ControllerClipboard } from '@/clipboard/controller/controller_clipboard.js';
import type { ClipboardSystemAccess } from '@/clipboard/system/clipboard_system_access.js';

/**
 * Cut, Copy and Paste commands for menu entries and shortcuts that run without
 * a clipboard event. They use the system clipboard when the webview allows it
 * and the text copied last inside the editor otherwise.
 */
export class ClipboardEditCommands {
  /**
   * Creates the commands.
   *
   * @param controller Clipboard controller doing the work.
   * @param systemAccess System clipboard reader and writer.
   */
  constructor(
    private readonly controller: ControllerClipboard,
    private readonly systemAccess: ClipboardSystemAccess,
  ) {}

  /**
   * Copies the selection and writes it to the system clipboard.
   *
   * @returns Settles once the system clipboard write finished or failed.
   */
  async copy(): Promise<void> {
    await this.systemTextWrite(this.controller.copy()?.text ?? null);
  }

  /**
   * Cuts the selection and writes it to the system clipboard.
   *
   * @returns Settles once the system clipboard write finished or failed.
   */
  async cut(): Promise<void> {
    await this.systemTextWrite(this.controller.cut()?.text ?? null);
  }

  /**
   * Pastes the clipboard under the pointer.
   *
   * @returns Settles once the paste ran.
   */
  async paste(): Promise<void> {
    const text = await this.clipboardTextRead();
    if (text !== null) {
      this.controller.pasteAtCursor(text);
    }
  }

  /**
   * Pastes the clipboard at the position it was copied from.
   *
   * @returns Settles once the paste ran.
   */
  async pasteAtOriginalPosition(): Promise<void> {
    const text = await this.clipboardTextRead();
    if (text !== null) {
      this.controller.pasteAtOriginalPosition(text);
    }
  }

  /**
   * Returns whether the selection holds anything to copy or cut.
   *
   * @returns True when something is selected.
   */
  selectionHasObjectsIs(): boolean {
    return this.controller.selectionHasObjectsIs();
  }

  /**
   * Writes copied text to the system clipboard.
   *
   * @param text Copied text, or null when nothing was copied.
   * @returns Settles once the write finished or failed.
   */
  private async systemTextWrite(text: string | null): Promise<void> {
    if (text !== null) {
      await this.systemAccess.textWrite(text);
    }
  }

  /**
   * Reads the system clipboard, falling back to the text copied last.
   *
   * @returns Clipboard text, or null when there is none.
   */
  private async clipboardTextRead(): Promise<string | null> {
    return this.systemAccess.textRead(this.controller.lastCopiedTextRead());
  }
}
