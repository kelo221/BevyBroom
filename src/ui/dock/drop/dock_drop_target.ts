import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';
import { DOCK_SIDES, type DockSide } from '@/ui/dock/dock_side.js';

/** Distance in CSS pixels from an edge of the dock area that docks to that edge. */
export const DOCK_DROP_EDGE_BAND_PX = 56;

/**
 * Width of the preview for a new left or right dock, as a share of the dock
 * area.
 */
const DOCK_DROP_PREVIEW_SHARE = 0.3;

/** Dock edge a released window would dock to and the area it would take. */
export interface DockDropTarget {
  /** Dock edge. */
  readonly side: DockSide;
  /** Area the docked window would cover, in client pixels. */
  readonly previewRect: PanelFloatingLayoutRect;
}

/** Layout the drop target is resolved against. */
export interface DockDropTargetInput {
  /** Pointer client X. */
  readonly clientX: number;
  /** Pointer client Y. */
  readonly clientY: number;
  /** Area the docks share: map views, info panel and the docks themselves. */
  readonly areaRect: PanelFloatingLayoutRect;
  /** Rects of the docks that are shown, by edge. */
  readonly shownZoneRects: Partial<Record<DockSide, PanelFloatingLayoutRect>>;
}

/**
 * Returns whether a point lies inside a rect.
 *
 * @param rect Rect.
 * @param clientX Point X.
 * @param clientY Point Y.
 * @returns True inside.
 */
function dockDropRectContains(rect: PanelFloatingLayoutRect, clientX: number, clientY: number): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.left + rect.width &&
    clientY >= rect.top &&
    clientY <= rect.top + rect.height
  );
}

/**
 * Returns the dock edge whose band of the dock area holds a point.
 *
 * @param input Pointer and layout.
 * @returns Edge, or null away from the edges or outside the area.
 */
function dockDropEdgeBandSide(input: DockDropTargetInput): DockSide | null {
  const area = input.areaRect;
  if (!dockDropRectContains(area, input.clientX, input.clientY)) {
    return null;
  }
  if (input.clientX <= area.left + DOCK_DROP_EDGE_BAND_PX) {
    return 'left';
  }
  if (input.clientX >= area.left + area.width - DOCK_DROP_EDGE_BAND_PX) {
    return 'right';
  }
  if (input.clientY >= area.top + area.height - DOCK_DROP_EDGE_BAND_PX) {
    return 'bottom';
  }
  return null;
}

/**
 * Returns the area a new dock on an edge would take.
 *
 * @param side Dock edge.
 * @param area Dock area rect.
 * @returns Preview rect.
 */
function dockDropNewZoneRect(side: DockSide, area: PanelFloatingLayoutRect): PanelFloatingLayoutRect {
  const width = area.width * DOCK_DROP_PREVIEW_SHARE;
  const height = area.height * DOCK_DROP_PREVIEW_SHARE;
  if (side === 'left') {
    return { left: area.left, top: area.top, width, height: area.height };
  }
  if (side === 'right') {
    return { left: area.left + area.width - width, top: area.top, width, height: area.height };
  }
  return { left: area.left, top: area.top + area.height - height, width: area.width, height };
}

/**
 * Resolves where a window dragged by its title bar would dock if released at a
 * point: onto a shown dock under the pointer, or onto the edge whose band of
 * the dock area holds the pointer.
 *
 * @param input Pointer and layout.
 * @returns Dock target, or null when releasing keeps the window floating.
 */
export function dockDropTargetResolve(input: DockDropTargetInput): DockDropTarget | null {
  for (const side of DOCK_SIDES) {
    const zoneRect = input.shownZoneRects[side];
    if (zoneRect && dockDropRectContains(zoneRect, input.clientX, input.clientY)) {
      return { side, previewRect: zoneRect };
    }
  }
  const side = dockDropEdgeBandSide(input);
  if (side === null) {
    return null;
  }
  return { side, previewRect: input.shownZoneRects[side] ?? dockDropNewZoneRect(side, input.areaRect) };
}
