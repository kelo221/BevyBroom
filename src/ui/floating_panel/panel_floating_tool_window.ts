import { PanelFloating, type FloatingPanelOptions } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';

/** Title, class and size of one floating tool window. */
export interface PanelFloatingToolWindowOptions {
  /** Title bar text. */
  readonly titleText: string;
  /** Class name of the window root. */
  readonly className: string;
  /** Outer width CSS value. */
  readonly width: string;
  /** Placement and dismiss options of the floating panel. */
  readonly floating: FloatingPanelOptions;
}

/**
 * Floating tool window with the editor's tool chrome, a standard title bar and
 * a padded body. Owns cleanup functions its subclasses register.
 */
export abstract class PanelFloatingToolWindow extends PanelFloating {
  protected readonly body: HTMLElement;
  private readonly disposers: Array<() => void> = [];

  /**
   * Creates the window shell: chrome, title bar and empty body.
   *
   * @param host Parent element hosting floating panels.
   * @param options Title, class, width and placement.
   */
  protected constructor(host: HTMLElement, options: PanelFloatingToolWindowOptions) {
    super(host, options.floating);
    this.root.classList.add(options.className);
    applyFloatingPanelToolChrome(this.root, { width: options.width, borderBox: true, overflowHidden: true });
    this.body = this.bodyCreate();
    const titleParts = this.createStandardTitleBar({ titleText: options.titleText, flexShrinkZero: true });
    this.root.append(titleParts.bar, this.body);
  }

  /** Runs every registered cleanup function and removes the window. */
  override dispose(): void {
    this.disposers.splice(0).forEach((disposer) => disposer());
    super.dispose();
  }

  /**
   * Registers a cleanup function run once by dispose.
   *
   * @param disposer Cleanup function, for example a listener removal.
   */
  protected disposerAdd(disposer: () => void): void {
    this.disposers.push(disposer);
  }

  /**
   * Creates the padded column holding the window content.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '6px';
    body.style.padding = '8px';
    return body;
  }
}
