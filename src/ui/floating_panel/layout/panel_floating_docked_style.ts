/** Attribute set on a window root while it shows inside a dock. */
export const PANEL_FLOATING_DOCKED_ATTRIBUTE = 'data-panel-floating-docked';

/**
 * Switches a window root between its floating look and a docked look that fills
 * its dock page without border, shadow or title bar, and back to exactly the
 * floating inline styles it had before.
 */
export class PanelFloatingDockedStyle {
  private savedRootCssText: string | null = null;
  private savedTitleBarDisplay = '';

  /**
   * Returns whether the docked look is applied.
   *
   * @returns True while docked.
   */
  isApplied(): boolean {
    return this.savedRootCssText !== null;
  }

  /**
   * Remembers the floating styles and applies the docked look.
   *
   * @param root Window root.
   * @param titleBar Window title bar, hidden while docked, or null.
   */
  apply(root: HTMLElement, titleBar: HTMLElement | null): void {
    if (this.isApplied()) {
      return;
    }
    this.savedRootCssText = root.style.cssText;
    this.savedTitleBarDisplay = titleBar?.style.display ?? '';
    this.rootDockedStylesApply(root);
    root.setAttribute(PANEL_FLOATING_DOCKED_ATTRIBUTE, '');
    if (titleBar !== null) {
      titleBar.style.display = 'none';
    }
  }

  /**
   * Puts the floating styles back.
   *
   * @param root Window root.
   * @param titleBar Window title bar, or null.
   */
  restore(root: HTMLElement, titleBar: HTMLElement | null): void {
    if (this.savedRootCssText === null) {
      return;
    }
    root.style.cssText = this.savedRootCssText;
    root.removeAttribute(PANEL_FLOATING_DOCKED_ATTRIBUTE);
    if (titleBar !== null) {
      titleBar.style.display = this.savedTitleBarDisplay;
    }
    this.savedRootCssText = null;
  }

  /**
   * Makes the root fill its dock page as a plain flex column.
   *
   * @param root Window root.
   */
  private rootDockedStylesApply(root: HTMLElement): void {
    const style = root.style;
    style.position = 'relative';
    style.left = style.top = style.right = style.bottom = 'auto';
    style.width = style.height = '100%';
    style.maxHeight = style.maxWidth = 'none';
    style.minHeight = style.minWidth = '0';
    style.flex = '1 1 auto';
    style.border = 'none';
    style.borderRadius = '0';
    style.boxShadow = 'none';
  }
}
