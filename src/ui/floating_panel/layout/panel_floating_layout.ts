import type { PanelFloating } from '../panel_floating.js';
import type { PanelFloatingDockBinding } from './panel_floating_dock_binding.js';
import { PanelFloatingDockedStyle } from './panel_floating_docked_style.js';
import { PanelFloatingLayoutRegistry } from './panel_floating_layout_registry.js';
import { panelFloatingLayoutRectOf, type PanelFloatingLayoutRect } from './panel_floating_layout_rect.js';
import { PanelFloatingResizeHandles } from './panel_floating_resize_handles.js';

/** Layout id and startup behaviour of a window that can be resized and docked. */
export interface PanelFloatingLayoutOptions {
  /** Stable id that keys the window's saved dock, position and size. */
  readonly layoutId: string;
  /** True to reopen the window at startup when it was open at quit. */
  readonly restoresOpen: boolean;
}

/**
 * Resizing, docking and remembered placement of one floating window: owns its
 * resize grab areas and docked look, and asks the dock system through the
 * window's binding where the window lives.
 */
export class PanelFloatingLayout {
  private readonly panel: PanelFloating;
  private readonly root: HTMLElement;
  private readonly options: PanelFloatingLayoutOptions;
  private readonly resizeHandles: PanelFloatingResizeHandles;
  private readonly dockedStyle = new PanelFloatingDockedStyle();
  private titleBar: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private dockedBinding: PanelFloatingDockBinding | null = null;

  /**
   * Adds resize grab areas to a window.
   *
   * @param panel Window laid out.
   * @param root Window root.
   * @param options Layout id and startup behaviour.
   */
  constructor(panel: PanelFloating, root: HTMLElement, options: PanelFloatingLayoutOptions) {
    this.panel = panel;
    this.root = root;
    this.options = options;
    this.resizeHandles = new PanelFloatingResizeHandles(root, () => this.floatingRectSave());
  }

  /**
   * Returns the id that keys the saved layout.
   *
   * @returns Layout id.
   */
  layoutIdRead(): string {
    return this.options.layoutId;
  }

  /**
   * Returns whether the window reopens at startup when it was open at quit.
   *
   * @returns True for reopening windows.
   */
  restoresOpenRead(): boolean {
    return this.options.restoresOpen;
  }

  /**
   * Returns the window title shown on its dock tab.
   *
   * @returns Title bar text, or the layout id without a title bar.
   */
  titleRead(): string {
    return this.titleElement?.textContent || this.options.layoutId;
  }

  /**
   * Remembers the title bar hidden while docked and its title, and opens the
   * layout menu on a right click on the bar.
   *
   * @param titleBar Window title bar.
   * @param titleElement Element holding the title text.
   */
  titleBarSet(titleBar: HTMLElement, titleElement: HTMLElement): void {
    this.titleBar = titleBar;
    this.titleElement = titleElement;
    titleBar.addEventListener('contextmenu', (event) => this.titleBarContextMenu(event));
  }

  /**
   * Returns whether the window lives in a dock.
   *
   * @returns True when its binding says docked.
   */
  isDocked(): boolean {
    return PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.isDocked() ?? false;
  }

  /**
   * Returns whether the window is shown inside a dock right now.
   *
   * @returns True between a docked mount and its unmount.
   */
  isMountedDocked(): boolean {
    return this.dockedBinding !== null;
  }

  /**
   * Shows the window in its dock when it is docked.
   *
   * @returns True when the window was mounted in a dock.
   */
  dockedMount(): boolean {
    const binding = PanelFloatingLayoutRegistry.bindingResolve(this.panel);
    if (binding === null || !binding.isDocked()) {
      return false;
    }
    this.dockedStyle.apply(this.root, this.titleBar);
    this.resizeHandles.visibleSet(false);
    this.dockedBinding = binding;
    binding.dockedMount();
    return true;
  }

  /** Takes the window out of its dock and puts its floating look back. */
  dockedUnmount(): void {
    const binding = this.dockedBinding;
    if (binding === null) {
      return;
    }
    this.dockedBinding = null;
    binding.dockedUnmount();
    this.dockedStyle.restore(this.root, this.titleBar);
    this.resizeHandles.visibleSet(true);
  }

  /**
   * Moves and sizes the floating window to its remembered rect.
   *
   * @returns True when a remembered rect was applied.
   */
  floatingRectRestore(): boolean {
    const rect = PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.floatingRectRead() ?? null;
    if (rect === null) {
      return false;
    }
    this.floatingRectApply(rect);
    return true;
  }

  /** Remembers the floating window's current rect. */
  floatingRectSave(): void {
    PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.floatingRectSave(panelFloatingLayoutRectOf(this.root));
  }

  /**
   * Shows the dock target under a title bar drag.
   *
   * @param event Pointer move of the drag.
   */
  titleDragMove(event: PointerEvent): void {
    PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.titleDragMove(event);
  }

  /**
   * Docks the window when the title bar drag ends over a dock target.
   *
   * @param event Pointer release of the drag.
   * @returns True when the window docked.
   */
  titleDragEnd(event: PointerEvent): boolean {
    return PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.titleDragEnd(event) ?? false;
  }

  /**
   * Remembers whether the window is open.
   *
   * @param isOpen Whether the window is open now.
   */
  openStateSave(isOpen: boolean): void {
    PanelFloatingLayoutRegistry.bindingResolve(this.panel)?.openStateSave(isOpen);
  }

  /** Forgets the window in the dock system. */
  dispose(): void {
    PanelFloatingLayoutRegistry.panelRemove(this.panel);
  }

  /**
   * Applies a rect to the floating root.
   *
   * @param rect Rect in client pixels.
   */
  private floatingRectApply(rect: PanelFloatingLayoutRect): void {
    this.root.style.left = `${rect.left}px`;
    this.root.style.top = `${rect.top}px`;
    this.root.style.right = 'auto';
    this.root.style.bottom = 'auto';
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
    this.root.style.maxHeight = 'none';
  }

  /**
   * Opens the layout menu on a right click on the title bar.
   *
   * @param event Context menu event.
   */
  private titleBarContextMenu(event: MouseEvent): void {
    const binding = PanelFloatingLayoutRegistry.bindingResolve(this.panel);
    if (binding === null) {
      return;
    }
    event.preventDefault();
    binding.layoutMenuOpen(event.clientX, event.clientY);
  }
}
