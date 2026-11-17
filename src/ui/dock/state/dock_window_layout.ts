import {
  panelFloatingLayoutRectRead,
  type PanelFloatingLayoutRect,
} from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import { dockSideIs, type DockSide } from '@/ui/dock/dock_side.js';

/** Saved placement of one tool window. */
export interface DockWindowLayout {
  /** Edge the window is docked to, or null while it floats. */
  readonly side: DockSide | null;
  /** Remembered floating position and size, or null before any move. */
  readonly floatingRect: PanelFloatingLayoutRect | null;
  /** True when the window was open last. */
  readonly isOpen: boolean;
}

/** Store of the saved placement of every tool window. */
export interface DockLayoutStorage {
  /**
   * Returns the saved placement of a window.
   *
   * @param windowId Window layout id.
   * @returns Saved placement, or the floating default.
   */
  windowLayoutRead(windowId: string): DockWindowLayout;
  /**
   * Saves the placement of a window.
   *
   * @param windowId Window layout id.
   * @param layout Placement to save.
   */
  windowLayoutWrite(windowId: string, layout: DockWindowLayout): void;
  /** Forgets every saved placement. */
  windowLayoutsClear(): void;
}

/**
 * Returns the placement of a window nobody moved yet: floating, closed, at its
 * default place.
 *
 * @returns Default placement.
 */
export function dockWindowLayoutDefault(): DockWindowLayout {
  return { side: null, floatingRect: null, isOpen: false };
}

/**
 * Reads a saved placement, falling back to defaults for missing or broken
 * parts.
 *
 * @param value Parsed saved value.
 * @returns Placement.
 */
export function dockWindowLayoutSanitize(value: unknown): DockWindowLayout {
  if (typeof value !== 'object' || value === null) {
    return dockWindowLayoutDefault();
  }
  const record = value as Record<string, unknown>;
  return {
    side: dockSideIs(record['side']) ? record['side'] : null,
    floatingRect: panelFloatingLayoutRectRead(record['floatingRect']),
    isOpen: record['isOpen'] === true,
  };
}

/**
 * Reads every saved placement of a record keyed by window id.
 *
 * @param value Parsed saved record.
 * @returns Placements by window id.
 */
export function dockWindowLayoutsSanitize(value: unknown): Record<string, DockWindowLayout> {
  const layouts: Record<string, DockWindowLayout> = {};
  if (typeof value !== 'object' || value === null) {
    return layouts;
  }
  Object.entries(value as Record<string, unknown>).forEach(([windowId, layout]) => {
    layouts[windowId] = dockWindowLayoutSanitize(layout);
  });
  return layouts;
}

/** Placement store kept in memory, for tests and windows without saved state. */
export class DockLayoutMemoryStorage implements DockLayoutStorage {
  private readonly layouts = new Map<string, DockWindowLayout>();

  /**
   * Returns the placement of a window.
   *
   * @param windowId Window layout id.
   * @returns Placement, or the floating default.
   */
  windowLayoutRead(windowId: string): DockWindowLayout {
    return this.layouts.get(windowId) ?? dockWindowLayoutDefault();
  }

  /**
   * Keeps the placement of a window.
   *
   * @param windowId Window layout id.
   * @param layout Placement.
   */
  windowLayoutWrite(windowId: string, layout: DockWindowLayout): void {
    this.layouts.set(windowId, layout);
  }

  /** Forgets every placement. */
  windowLayoutsClear(): void {
    this.layouts.clear();
  }
}
