import { handlerKeyboardShortcutIsTypingTarget } from '@/input/handler_keyboard_shortcut_types.js';

/** MIME type the editor reads and writes on clipboard events. */
const CLIPBOARD_EVENT_TEXT_TYPE = 'text/plain';

/** Clipboard commands the event bridge runs. */
export interface ClipboardEventBridgeCommands {
  /**
   * Copies the selection.
   *
   * @returns Copy result holding the clipboard text, or null when nothing was
   *   copied.
   */
  copy(): { readonly text: string } | null;
  /**
   * Cuts the selection.
   *
   * @returns Cut result holding the clipboard text, or null when nothing was
   *   cut.
   */
  cut(): { readonly text: string } | null;
  /**
   * Pastes clipboard text under the pointer.
   *
   * @param text Clipboard text.
   * @returns A result when something was pasted, null otherwise.
   */
  pasteAtCursor(text: string): object | null;
}

/**
 * Runs Copy, Cut and Paste from the document's clipboard events, which the
 * browser and desktop webview raise for Ctrl+C, Ctrl+X and Ctrl+V. Events aimed
 * at text fields, and copies of selected page text, keep their default
 * behavior.
 */
export class ClipboardEventBridge {
  private readonly copyListener = (event: ClipboardEvent): void => this.copyHandle(event);
  private readonly cutListener = (event: ClipboardEvent): void => this.cutHandle(event);
  private readonly pasteListener = (event: ClipboardEvent): void => this.pasteHandle(event);

  /**
   * Creates the bridge without listening yet.
   *
   * @param targetDocument Document whose clipboard events are handled.
   * @param commands Clipboard commands to run.
   */
  constructor(
    private readonly targetDocument: Document,
    private readonly commands: ClipboardEventBridgeCommands,
  ) {}

  /** Starts listening to copy, cut and paste events. */
  register(): void {
    this.targetDocument.addEventListener('copy', this.copyListener);
    this.targetDocument.addEventListener('cut', this.cutListener);
    this.targetDocument.addEventListener('paste', this.pasteListener);
  }

  /** Stops listening to copy, cut and paste events. */
  unregister(): void {
    this.targetDocument.removeEventListener('copy', this.copyListener);
    this.targetDocument.removeEventListener('cut', this.cutListener);
    this.targetDocument.removeEventListener('paste', this.pasteListener);
  }

  /**
   * Copies the selection into the event's clipboard data.
   *
   * @param event Copy event.
   */
  private copyHandle(event: ClipboardEvent): void {
    if (this.eventOwnedByPageIs(event)) {
      return;
    }
    this.eventTextWrite(event, this.commands.copy()?.text ?? null);
  }

  /**
   * Cuts the selection into the event's clipboard data.
   *
   * @param event Cut event.
   */
  private cutHandle(event: ClipboardEvent): void {
    if (this.eventOwnedByPageIs(event)) {
      return;
    }
    this.eventTextWrite(event, this.commands.cut()?.text ?? null);
  }

  /**
   * Pastes the event's clipboard text and stops the default paste when it held
   * editor objects.
   *
   * @param event Paste event.
   */
  private pasteHandle(event: ClipboardEvent): void {
    if (handlerKeyboardShortcutIsTypingTarget(event.target) || event.clipboardData === null) {
      return;
    }
    const pasted = this.commands.pasteAtCursor(event.clipboardData.getData(CLIPBOARD_EVENT_TEXT_TYPE));
    if (pasted !== null) {
      event.preventDefault();
    }
  }

  /**
   * Returns whether a copy or cut belongs to a text field or to page text the
   * user selected.
   *
   * @param event Copy or cut event.
   * @returns True when the default behavior must run.
   */
  private eventOwnedByPageIs(event: ClipboardEvent): boolean {
    if (handlerKeyboardShortcutIsTypingTarget(event.target)) {
      return true;
    }
    const pageSelection = this.targetDocument.getSelection();
    return pageSelection !== null && !pageSelection.isCollapsed && pageSelection.toString().length > 0;
  }

  /**
   * Puts copied text into the event's clipboard data and stops the default
   * copy.
   *
   * @param event Copy or cut event.
   * @param text Copied text, or null when nothing was copied.
   */
  private eventTextWrite(event: ClipboardEvent, text: string | null): void {
    if (text === null || event.clipboardData === null) {
      return;
    }
    event.clipboardData.setData(CLIPBOARD_EVENT_TEXT_TYPE, text);
    event.preventDefault();
  }
}
