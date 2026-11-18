import type { PanelFloatingLayoutRect } from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';

/** Gap between tiled windows and around them in CSS pixels. */
export const DOCK_FLOATING_TILE_GAP_PX = 6;

/**
 * Splits an area into a near-square grid of equal cells, one per window, in
 * reading order.
 *
 * @param area Area to fill, in client pixels.
 * @param windowCount Number of windows.
 * @returns One rect per window.
 */
export function dockFloatingTileRectsCompute(
  area: PanelFloatingLayoutRect,
  windowCount: number,
): PanelFloatingLayoutRect[] {
  if (windowCount <= 0) {
    return [];
  }
  const columnCount = Math.ceil(Math.sqrt(windowCount));
  const rowCount = Math.ceil(windowCount / columnCount);
  const gap = DOCK_FLOATING_TILE_GAP_PX;
  const cellWidth = (area.width - gap * (columnCount + 1)) / columnCount;
  const cellHeight = (area.height - gap * (rowCount + 1)) / rowCount;
  return Array.from({ length: windowCount }, (_, index) => ({
    left: area.left + gap + (index % columnCount) * (cellWidth + gap),
    top: area.top + gap + Math.floor(index / columnCount) * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight,
  }));
}
