import { PanelFloating, type FloatingPanelCorner } from './panel_floating.js';
import { applyFloatingPanelToolChrome } from './panel_floating_tool_chrome.js';

/** Title, size and placement of a floating window that hosts one element. */
export interface PanelFloatingContentHostOptions {
  /** Title bar text. */
  readonly titleText: string;
  /** Class name added to the window root. */
  readonly className: string;
  /** Outer width CSS value. */
  readonly width: string;
  /** Outer height CSS value. */
  readonly height: string;
  /** Corner of the anchor used for the first open position. */
  readonly corner: FloatingPanelCorner;
  /**
   * True to center the window on its first open and keep its dragged position
   * on later opens; it opens at the corner when omitted.
   */
  readonly centered?: boolean;
  /** True to close the window on Escape; stays open on Escape when omitted. */
  readonly closeOnEscape?: boolean;
}

/**
 * Non-modal floating tool window with a draggable title bar and one body that
 * hosts an element, reporting every open and close to a listener.
 */
export class PanelFloatingContentHost extends PanelFloating {
  private readonly body: HTMLElement;
  private readonly openChangeListeners: Set<(isOpen: boolean) => void>;

  /**
   * Creates the floating window and mounts the hosted element into its body.
   *
   * @param host Parent element of floating windows.
   * @param options Title, size and placement.
   * @param content Element shown in the window body.
   */
  constructor(host: HTMLElement, options: PanelFloatingContentHostOptions, content: HTMLElement) {
    super(host, {
      corner: options.corner,
      insetBelowViewportToolbar: true,
      draggable: true,
      centered: options.centered === true,
      closeOnEscape: options.closeOnEscape ?? false,
    });
    this.openChangeListeners = new Set();
    this.body = this.bodyCreate();
    this.shellBuild(options);
    this.body.appendChild(content);
  }

  /**
   * Returns the body element that holds the hosted element.
   *
   * @returns Body element.
   */
  bodyRead(): HTMLElement {
    return this.body;
  }

  /**
   * Registers a listener told whether the window is open after every open and
   * close.
   *
   * @param listener Called with true after opening and false after closing.
   * @returns Function that removes the listener.
   */
  openChangeListenerAdd(listener: (isOpen: boolean) => void): () => void {
    this.openChangeListeners.add(listener);
    return () => {
      this.openChangeListeners.delete(listener);
    };
  }

  /** Hides the window, drops its listeners and removes it from the document. */
  override dispose(): void {
    super.dispose();
    this.openChangeListeners.clear();
  }

  /** Tells the listeners that the window opened. */
  protected override onAfterShow(): void {
    this.openChangeListenersNotify(true);
  }

  /** Tells the listeners that the window closed. */
  protected override onAfterHide(): void {
    this.openChangeListenersNotify(false);
  }

  /**
   * Calls every open change listener.
   *
   * @param isOpen Whether the window is open now.
   */
  private openChangeListenersNotify(isOpen: boolean): void {
    this.openChangeListeners.forEach((listener) => listener(isOpen));
  }

  /**
   * Styles the window root and mounts the title bar and body.
   *
   * @param options Title, size and placement.
   */
  private shellBuild(options: PanelFloatingContentHostOptions): void {
    this.root.classList.add(options.className);
    applyFloatingPanelToolChrome(this.root, {
      width: options.width,
      height: options.height,
      maxHeight: 'calc(100vh - 48px)',
      borderBox: true,
      overflowHidden: true,
    });
    const titleParts = this.createStandardTitleBar({ titleText: options.titleText, flexShrinkZero: true });
    this.root.append(titleParts.bar, this.body);
  }

  /**
   * Creates the body that fills the window below the title bar.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.classList.add('panel-floating-content-host-body');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.flex = '1 1 auto';
    body.style.minHeight = '0';
    body.style.overflow = 'hidden';
    return body;
  }
}
