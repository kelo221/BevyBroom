import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/**
 * A docked panel of the main window: one root element that fills its parent
 * pane and paints the panel background.
 */
export class ShellDock {
  private readonly dockRoot: HTMLElement;

  /**
   * Creates a dock around a root element and styles it to fill its pane.
   *
   * @param dockRoot Root element of the dock.
   */
  constructor(dockRoot: HTMLElement) {
    this.dockRoot = dockRoot;
    this.dockRootStyle();
  }

  /**
   * Returns the dock root element.
   *
   * @returns Root element of the dock.
   */
  getElement(): HTMLElement {
    return this.dockRoot;
  }

  /** Removes the dock from the document. */
  dispose(): void {
    this.dockRoot.remove();
  }

  /** Fills the parent pane with the dock and paints the panel background. */
  private dockRootStyle(): void {
    this.dockRoot.style.flex = '1 1 auto';
    this.dockRoot.style.minHeight = '0';
    this.dockRoot.style.minWidth = '0';
    this.dockRoot.style.background = hexToRgb(Theme.propertiesPanelBackground);
  }
}
