/**
 * Stops the page from selecting text while a pointer gesture such as a drag
 * runs: clears any selection, turns text selection off on the document body,
 * and restores the body's earlier setting when the gesture ends.
 */
export class TextSelectionSuppression {
  private readonly ownerDocument: Document;
  private savedUserSelect: string | null = null;
  private savedWebkitUserSelect: string | null = null;

  /**
   * Creates an inactive suppression for one document.
   *
   * @param ownerDocument Document whose body stops selecting text.
   */
  constructor(ownerDocument: Document) {
    this.ownerDocument = ownerDocument;
  }

  /**
   * Returns whether text selection is turned off by this suppression.
   *
   * @returns True between begin and end.
   */
  isActive(): boolean {
    return this.savedUserSelect !== null;
  }

  /** Clears the current selection and turns text selection off on the body. */
  begin(): void {
    this.selectionClear();
    if (this.isActive()) {
      return;
    }
    const bodyStyle = this.ownerDocument.body.style;
    this.savedUserSelect = bodyStyle.userSelect;
    this.savedWebkitUserSelect = bodyStyle.getPropertyValue('-webkit-user-select');
    bodyStyle.userSelect = 'none';
    bodyStyle.setProperty('-webkit-user-select', 'none');
  }

  /** Clears any selection made meanwhile and restores the body's setting. */
  end(): void {
    if (!this.isActive()) {
      return;
    }
    this.selectionClear();
    const bodyStyle = this.ownerDocument.body.style;
    bodyStyle.userSelect = this.savedUserSelect ?? '';
    bodyStyle.setProperty('-webkit-user-select', this.savedWebkitUserSelect ?? '');
    this.savedUserSelect = null;
    this.savedWebkitUserSelect = null;
  }

  /** Removes every range from the document selection. */
  private selectionClear(): void {
    this.ownerDocument.getSelection()?.removeAllRanges();
  }
}
