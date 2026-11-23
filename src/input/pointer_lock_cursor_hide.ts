/** Id of the style element holding the hidden cursor rule in a document. */
const POINTER_LOCK_CURSOR_HIDE_STYLE_ID = 'bevybroom-pointer-lock-cursor-hide';

/**
 * Class on the root element that hides the mouse cursor everywhere in its
 * document.
 */
export const POINTER_LOCK_CURSOR_HIDE_CLASS = 'bevybroom-pointer-lock-cursor-hidden';

/**
 * Hides the mouse cursor in a whole document while a pointer lock is held, so
 * the cursor disappears even where the page is not granted the browser pointer
 * lock, such as an embedded web view that refuses it.
 */
export class PointerLockCursorHide {
  /**
   * Hides the cursor in a document.
   *
   * @param ownerDocument Document whose cursor is hidden.
   */
  static hide(ownerDocument: Document): void {
    PointerLockCursorHide.styleEnsure(ownerDocument);
    ownerDocument.documentElement.classList.add(POINTER_LOCK_CURSOR_HIDE_CLASS);
  }

  /**
   * Shows the cursor in a document again.
   *
   * @param ownerDocument Document whose cursor was hidden.
   */
  static show(ownerDocument: Document): void {
    ownerDocument.documentElement.classList.remove(POINTER_LOCK_CURSOR_HIDE_CLASS);
  }

  /**
   * Returns whether the cursor is hidden in a document.
   *
   * @param ownerDocument Document to check.
   * @returns True while the hiding class is on its root element.
   */
  static isHidden(ownerDocument: Document): boolean {
    return ownerDocument.documentElement.classList.contains(POINTER_LOCK_CURSOR_HIDE_CLASS);
  }

  /**
   * Adds the hidden cursor rule to a document once. The rule wins over inline
   * cursor styles that other tools set on elements.
   *
   * @param ownerDocument Document receiving the rule.
   */
  private static styleEnsure(ownerDocument: Document): void {
    if (ownerDocument.getElementById(POINTER_LOCK_CURSOR_HIDE_STYLE_ID)) {
      return;
    }
    const styleElement = ownerDocument.createElement('style');
    styleElement.id = POINTER_LOCK_CURSOR_HIDE_STYLE_ID;
    const selector = `html.${POINTER_LOCK_CURSOR_HIDE_CLASS}`;
    styleElement.textContent = `${selector}, ${selector} * { cursor: none !important; }`;
    ownerDocument.head.appendChild(styleElement);
  }
}
