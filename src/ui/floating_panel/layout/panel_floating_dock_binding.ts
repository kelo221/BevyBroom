import type { PanelFloatingLayoutRect } from './panel_floating_layout_rect.js';

/**
 * Connects one floating window that has a layout id to the dock system: where
 * it is docked, where it floats, and what happens while its title bar is
 * dragged.
 */
export interface PanelFloatingDockBinding {
  /**
   * Returns whether the window shows inside a dock instead of floating.
   *
   * @returns True while docked.
   */
  isDocked(): boolean;
  /** Puts the window's root into its dock and shows it there. */
  dockedMount(): void;
  /** Takes the window's root out of its dock. */
  dockedUnmount(): void;
  /**
   * Returns the remembered floating position and size.
   *
   * @returns Rect, or null before the window was moved or resized.
   */
  floatingRectRead(): PanelFloatingLayoutRect | null;
  /**
   * Remembers the floating position and size.
   *
   * @param rect Window rect in client pixels.
   */
  floatingRectSave(rect: PanelFloatingLayoutRect): void;
  /**
   * Shows where the window would dock if its title bar were released here.
   *
   * @param event Pointer move of the title bar drag.
   */
  titleDragMove(event: PointerEvent): void;
  /**
   * Docks the window when its title bar is released over a dock target.
   *
   * @param event Pointer release of the title bar drag.
   * @returns True when the window docked.
   */
  titleDragEnd(event: PointerEvent): boolean;
  /**
   * Opens the window's layout menu (dock edges, float, close) at a point.
   *
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  layoutMenuOpen(clientX: number, clientY: number): void;
  /**
   * Remembers whether the window is open, for windows reopened at startup.
   *
   * @param isOpen Whether the window is open now.
   */
  openStateSave(isOpen: boolean): void;
}
