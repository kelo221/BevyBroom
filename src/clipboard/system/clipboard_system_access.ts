/** Text clipboard calls the system clipboard offers. */
export type ClipboardSystemTextApi = Pick<Clipboard, 'readText' | 'writeText'>;

/**
 * Returns the browser's asynchronous clipboard when the page may use it.
 *
 * @returns Clipboard API, or null when unavailable.
 */
function clipboardSystemNavigatorApiRead(): ClipboardSystemTextApi | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return null;
  }
  return navigator.clipboard;
}

/**
 * Reads and writes system clipboard text for commands that run without a
 * clipboard event, such as menu entries. Every failure is swallowed because
 * webviews may deny clipboard access.
 */
export class ClipboardSystemAccess {
  /**
   * Creates the access over a clipboard API source.
   *
   * @param apiRead Returns the system clipboard API, or null when there is
   *   none.
   */
  constructor(private readonly apiRead: () => ClipboardSystemTextApi | null = clipboardSystemNavigatorApiRead) {}

  /**
   * Writes text to the system clipboard when possible.
   *
   * @param text Text to write.
   * @returns True when the system clipboard accepted the text.
   */
  async textWrite(text: string): Promise<boolean> {
    const api = this.apiRead();
    if (api === null) {
      return false;
    }
    try {
      await api.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads system clipboard text, falling back when it cannot be read or is
   * empty.
   *
   * @param fallbackText Text used when the system clipboard yields nothing.
   * @returns Clipboard text, the fallback, or null when neither exists.
   */
  async textRead(fallbackText: string | null): Promise<string | null> {
    const api = this.apiRead();
    if (api === null) {
      return fallbackText;
    }
    try {
      const text = await api.readText();
      return text.length > 0 ? text : fallbackText;
    } catch {
      return fallbackText;
    }
  }
}
