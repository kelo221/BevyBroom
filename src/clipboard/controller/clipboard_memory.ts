/**
 * Remembers the clipboard text the editor copied last, so pasting still works
 * when the system clipboard cannot be read.
 */
export class ClipboardMemory {
  private lastCopiedText: string | null = null;

  /**
   * Returns the text copied last.
   *
   * @returns Copied text, or null before the first copy.
   */
  lastCopiedTextRead(): string | null {
    return this.lastCopiedText;
  }

  /**
   * Remembers the text just copied.
   *
   * @param text Copied text.
   */
  lastCopiedTextWrite(text: string): void {
    this.lastCopiedText = text;
  }
}

/** Clipboard memory shared by the editor window and the MCP tools. */
export const clipboardMemoryShared = new ClipboardMemory();
