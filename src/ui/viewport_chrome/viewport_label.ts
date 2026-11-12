import { Theme } from '@/theme.js';

/** CSS class of the clickable corner label of a viewport. */
export const VIEWPORT_LABEL_CLASS = 'editor-viewport-corner-label';

/**
 * Hammer-style corner label of a viewport ("camera", "top (x/z)"): a small
 * black and white button at the top-left that opens the view menu.
 */
export class ViewportLabel {
  private readonly labelElement: HTMLButtonElement;

  /**
   * Creates the label inside the parent element.
   *
   * @param parentElement Element that receives the label.
   * @param labelText Text shown in the label.
   * @param onClick Invoked when the label is clicked.
   */
  constructor(parentElement: HTMLElement, labelText: string, onClick: () => void) {
    this.labelElement = parentElement.ownerDocument.createElement('button');
    this.labelElement.type = 'button';
    this.labelElement.setAttribute('aria-haspopup', 'menu');
    this.labelElement.setAttribute('aria-expanded', 'false');
    this.applyStyles();
    this.textSet(labelText, labelText);
    this.labelElement.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    parentElement.appendChild(this.labelElement);
  }

  /**
   * Shows new label text and a tooltip naming the view.
   *
   * @param labelText Text shown in the label.
   * @param viewName Name of the view used in the tooltip.
   */
  textSet(labelText: string, viewName: string): void {
    this.labelElement.textContent = labelText;
    this.labelElement.title = `${viewName} view: click for view options`;
    this.labelElement.setAttribute('aria-label', `${viewName} view options`);
  }

  /**
   * Marks whether the menu opened by the label is shown.
   *
   * @param expanded True while the menu is open.
   */
  expandedSet(expanded: boolean): void {
    this.labelElement.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  /**
   * Returns the root label DOM element.
   *
   * @returns The label button.
   */
  getLabelElement(): HTMLButtonElement {
    return this.labelElement;
  }

  /** Applies the compact corner placement and the theme label colors. */
  private applyStyles(): void {
    this.labelElement.classList.add(VIEWPORT_LABEL_CLASS);
    this.labelElement.style.height = `${Theme.viewportLabelHeightPx}px`;
    this.labelElement.style.margin = '0';
    this.labelElement.style.padding = '0 4px';
    this.labelElement.style.border = 'none';
    this.labelElement.style.borderRadius = `${Theme.viewportLabelRadiusPx}px`;
    this.labelElement.style.fontFamily = Theme.uiFontFamily;
    this.labelElement.style.fontSize = `${Theme.uiFontSizePx}px`;
    this.labelElement.style.lineHeight = `${Theme.viewportLabelHeightPx}px`;
    this.labelElement.style.color = Theme.viewportLabelTextColor;
    this.labelElement.style.background = Theme.viewportLabelBackgroundColor;
    this.labelElement.style.whiteSpace = 'nowrap';
    this.labelElement.style.cursor = 'pointer';
    this.labelElement.style.userSelect = 'none';
  }
}
