import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/**
 * Base of the views shown in the bottom info panel. Owns a root element that
 * fills its host as a flex column and removes it again on dispose.
 */
export abstract class InfoPanelView {
  protected readonly rootElement: HTMLElement;
  protected isDisposed = false;

  /**
   * Creates the root element.
   *
   * @param className CSS class of the root element.
   */
  protected constructor(className: string) {
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('editor-info-panel-view', className);
    InfoPanelView.rootElementStyle(this.rootElement);
  }

  /**
   * Returns the root element to mount into the hosting tab.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.rootElement;
  }

  /** Stops listening, releases resources and removes the root element. */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.disposeContent();
    this.rootElement.remove();
  }

  /** Releases what the derived view holds; runs once on dispose. */
  protected abstract disposeContent(): void;

  /**
   * Styles a root element to fill its host as a dark flex column.
   *
   * @param rootElement Root element.
   */
  private static rootElementStyle(rootElement: HTMLElement): void {
    rootElement.style.display = 'flex';
    rootElement.style.flexDirection = 'column';
    rootElement.style.height = '100%';
    rootElement.style.width = '100%';
    rootElement.style.minHeight = '0';
    rootElement.style.boxSizing = 'border-box';
    rootElement.style.background = hexToRgb(Theme.outlinerBackground);
    rootElement.style.color = Theme.inputTextColor;
  }
}
