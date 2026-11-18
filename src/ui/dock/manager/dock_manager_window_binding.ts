import type { PanelFloatingDockBinding } from '@/ui/floating_panel/layout/panel_floating_dock_binding.js';
import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import type { DockSide } from '@/ui/dock/dock_side.js';
import type { DockWindowLayout } from '@/ui/dock/state/dock_window_layout.js';

/** What the binding of one window asks of the dock manager. */
export interface DockManagerWindowBindingHost {
  /**
   * Returns the saved placement of a window.
   *
   * @param windowId Window layout id.
   * @returns Placement.
   */
  windowLayoutRead(windowId: string): DockWindowLayout;
  /**
   * Changes parts of the saved placement of a window.
   *
   * @param windowId Window layout id.
   * @param changes Parts to replace.
   */
  windowLayoutUpdate(windowId: string, changes: Partial<DockWindowLayout>): void;
  /**
   * Puts a window's root into the dock of its side.
   *
   * @param windowId Window layout id.
   */
  zoneMount(windowId: string): void;
  /**
   * Takes a window's root out of the dock it shows in.
   *
   * @param windowId Window layout id.
   */
  zoneUnmount(windowId: string): void;
  /**
   * Shows where a title bar drag would dock.
   *
   * @param event Pointer move of the drag.
   */
  dropPreviewUpdate(event: PointerEvent): void;
  /**
   * Returns the dock edge under a title bar release and hides the preview.
   *
   * @param event Pointer release of the drag.
   * @returns Dock edge, or null to keep floating.
   */
  dropTargetTake(event: PointerEvent): DockSide | null;
  /**
   * Docks a window to an edge, or floats it with null.
   *
   * @param windowId Window layout id.
   * @param side Dock edge, or null.
   */
  windowDock(windowId: string, side: DockSide | null): void;
  /**
   * Opens the layout menu of a window.
   *
   * @param windowId Window layout id.
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  windowMenuOpen(windowId: string, clientX: number, clientY: number): void;
}

/** Dock binding of one window, answering from the dock manager's saved layout. */
export class DockManagerWindowBinding implements PanelFloatingDockBinding {
  private readonly windowId: string;
  private readonly host: DockManagerWindowBindingHost;
  private mountedSide: DockSide | null = null;

  /**
   * Creates the binding of one window.
   *
   * @param windowId Window layout id.
   * @param host Dock manager callbacks.
   */
  constructor(windowId: string, host: DockManagerWindowBindingHost) {
    this.windowId = windowId;
    this.host = host;
  }

  /**
   * Returns whether the window lives in a dock.
   *
   * @returns True when its saved placement names an edge.
   */
  isDocked(): boolean {
    return this.host.windowLayoutRead(this.windowId).side !== null;
  }

  /**
   * Returns the edge the window's root is mounted on.
   *
   * @returns Edge, or null while not mounted in a dock.
   */
  mountedSideRead(): DockSide | null {
    return this.mountedSide;
  }

  /** Puts the window's root into the dock of its side. */
  dockedMount(): void {
    this.mountedSide = this.host.windowLayoutRead(this.windowId).side;
    this.host.zoneMount(this.windowId);
  }

  /** Takes the window's root out of its dock. */
  dockedUnmount(): void {
    this.host.zoneUnmount(this.windowId);
    this.mountedSide = null;
  }

  /**
   * Returns the remembered floating rect.
   *
   * @returns Rect, or null.
   */
  floatingRectRead(): PanelFloatingLayoutRect | null {
    return this.host.windowLayoutRead(this.windowId).floatingRect;
  }

  /**
   * Remembers the floating rect.
   *
   * @param rect Rect in client pixels.
   */
  floatingRectSave(rect: PanelFloatingLayoutRect): void {
    this.host.windowLayoutUpdate(this.windowId, { floatingRect: rect });
  }

  /**
   * Shows where the window would dock.
   *
   * @param event Pointer move of the title bar drag.
   */
  titleDragMove(event: PointerEvent): void {
    this.host.dropPreviewUpdate(event);
  }

  /**
   * Docks the window when released over a dock target.
   *
   * @param event Pointer release of the title bar drag.
   * @returns True when the window docked.
   */
  titleDragEnd(event: PointerEvent): boolean {
    const side = this.host.dropTargetTake(event);
    if (side === null) {
      return false;
    }
    this.host.windowDock(this.windowId, side);
    return true;
  }

  /**
   * Opens the layout menu.
   *
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  layoutMenuOpen(clientX: number, clientY: number): void {
    this.host.windowMenuOpen(this.windowId, clientX, clientY);
  }

  /**
   * Remembers whether the window is open.
   *
   * @param isOpen Whether the window is open now.
   */
  openStateSave(isOpen: boolean): void {
    this.host.windowLayoutUpdate(this.windowId, { isOpen });
  }
}
