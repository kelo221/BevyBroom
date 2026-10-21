import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';

/** Edge length of a tile thumbnail in CSS pixels. */
export const ENTITY_BROWSER_TILE_THUMBNAIL_PX = 56;

/** Icon size drawn inside a tile thumbnail in CSS pixels. */
export const ENTITY_BROWSER_TILE_ICON_PX = 28;

/** Selection color of tiles: the editor's orange. */
const ENTITY_BROWSER_SELECTION_COLOR = hexToRgb(Theme.selectionColor);

/**
 * Styles the browser root: a column with the tile grid above the controls.
 *
 * @param root Root element.
 */
export function entityBrowserStyleRoot(root: HTMLElement): void {
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.minHeight = '0';
  root.style.height = '100%';
  root.style.boxSizing = 'border-box';
  root.style.background = `linear-gradient(180deg, ${hexToRgb(Theme.propertiesPanelBackground)} 0%, #15171c 100%)`;
  root.style.color = Theme.buttonTextColor;
  root.style.fontFamily = Theme.uiFontFamily;
  root.style.fontSize = '12px';
}

/**
 * Styles the scrollable, focusable tile area.
 *
 * @param scroller Tile area element.
 */
export function entityBrowserStyleScroller(scroller: HTMLElement): void {
  scroller.style.flex = '1 1 auto';
  scroller.style.minHeight = '0';
  scroller.style.overflowY = 'auto';
  scroller.style.padding = '6px';
  scroller.style.outline = 'none';
}

/**
 * Styles a category header above a group of tiles.
 *
 * @param header Header element.
 */
export function entityBrowserStyleGroupHeader(header: HTMLElement): void {
  header.style.margin = '6px 2px 4px';
  header.style.paddingBottom = '2px';
  header.style.borderBottom = `1px solid ${Theme.statusBarBorderColor}`;
  header.style.color = Theme.statusBarTextColor;
  header.style.fontSize = '11px';
  header.style.fontWeight = '600';
}

/**
 * Styles the wrapping grid holding the tiles of one group.
 *
 * @param grid Grid element.
 */
export function entityBrowserStyleGroupGrid(grid: HTMLElement): void {
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${ENTITY_BROWSER_TILE_THUMBNAIL_PX + 16}px, 1fr))`;
  grid.style.gap = '4px';
}

/**
 * Styles a tile: thumbnail on top, name below.
 *
 * @param tile Tile element.
 */
export function entityBrowserStyleTile(tile: HTMLElement): void {
  tile.style.display = 'flex';
  tile.style.flexDirection = 'column';
  tile.style.alignItems = 'center';
  tile.style.gap = '3px';
  tile.style.padding = '4px 2px';
  tile.style.borderRadius = '4px';
  tile.style.cursor = 'grab';
  tile.style.userSelect = 'none';
  tile.style.position = 'relative';
  entityBrowserStyleTileSelected(tile, false);
}

/**
 * Shows or hides the selection highlight of a tile.
 *
 * @param tile Tile element.
 * @param isSelected True for the selected tile.
 */
export function entityBrowserStyleTileSelected(tile: HTMLElement, isSelected: boolean): void {
  tile.style.border = `1px solid ${isSelected ? ENTITY_BROWSER_SELECTION_COLOR : 'transparent'}`;
  tile.style.background = isSelected ? Theme.outlinerSelectedColor : 'transparent';
}

/**
 * Styles a tile thumbnail: a colored square holding the icon.
 *
 * @param thumbnail Thumbnail element.
 * @param backgroundColor CSS background color.
 */
export function entityBrowserStyleThumbnail(thumbnail: HTMLElement, backgroundColor: string): void {
  thumbnail.style.width = `${ENTITY_BROWSER_TILE_THUMBNAIL_PX}px`;
  thumbnail.style.height = `${ENTITY_BROWSER_TILE_THUMBNAIL_PX}px`;
  thumbnail.style.display = 'flex';
  thumbnail.style.alignItems = 'center';
  thumbnail.style.justifyContent = 'center';
  thumbnail.style.borderRadius = '4px';
  thumbnail.style.background = `linear-gradient(160deg, ${backgroundColor} 0%, #121318 100%)`;
  thumbnail.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)';
  thumbnail.style.fontSize = `${ENTITY_BROWSER_TILE_ICON_PX}px`;
}

/**
 * Styles the name under a tile thumbnail.
 *
 * @param label Label element.
 */
export function entityBrowserStyleTileLabel(label: HTMLElement): void {
  label.style.maxWidth = '100%';
  label.style.overflow = 'hidden';
  label.style.textOverflow = 'ellipsis';
  label.style.whiteSpace = 'nowrap';
  label.style.fontSize = '11px';
  label.style.textAlign = 'center';
}

/**
 * Styles the usage count badge in a tile corner.
 *
 * @param badge Badge element.
 */
export function entityBrowserStyleUsageBadge(badge: HTMLElement): void {
  badge.style.position = 'absolute';
  badge.style.top = '3px';
  badge.style.right = '5px';
  badge.style.padding = '0 4px';
  badge.style.borderRadius = '6px';
  badge.style.background = 'rgba(0, 0, 0, 0.6)';
  badge.style.color = Theme.statusBarTextColor;
  badge.style.fontSize = '10px';
}

/**
 * Styles the controls row under the tiles.
 *
 * @param row Controls row element.
 */
export function entityBrowserStyleControlsRow(row: HTMLElement): void {
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.style.padding = '4px 6px';
  row.style.borderTop = `1px solid ${Theme.statusBarBorderColor}`;
  row.style.background = hexToRgb(Theme.toolbarBackgroundEnd);
  row.style.flex = '0 0 auto';
}

/**
 * Shows whether a toggle button is switched on with an orange outline.
 *
 * @param button Toggle button.
 * @param isActive True when the toggle is on.
 */
export function entityBrowserStyleToggleActive(button: HTMLButtonElement, isActive: boolean): void {
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  button.style.borderColor = isActive ? ENTITY_BROWSER_SELECTION_COLOR : Theme.inputBorderColor;
  button.style.color = isActive ? ENTITY_BROWSER_SELECTION_COLOR : Theme.buttonTextColor;
}

/**
 * Styles the drag ghost that follows the pointer.
 *
 * @param ghost Ghost element.
 */
export function entityBrowserStyleDragGhost(ghost: HTMLElement): void {
  ghost.style.position = 'fixed';
  ghost.style.left = '0';
  ghost.style.top = '0';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = String(UiStackLayers.dragGhost);
  ghost.style.opacity = '0.85';
  ghost.style.borderRadius = '4px';
  ghost.style.background = hexToRgb(Theme.toolbarBackground);
  ghost.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.55)';
  ghost.style.color = Theme.buttonTextColor;
  ghost.style.fontFamily = Theme.uiFontFamily;
}

/**
 * Shows whether the ghost is over a place where the tile can be dropped.
 *
 * @param ghost Ghost element.
 * @param isOverTarget True over a drop target.
 */
export function entityBrowserStyleDragGhostTarget(ghost: HTMLElement, isOverTarget: boolean): void {
  ghost.style.outline = `1px solid ${isOverTarget ? ENTITY_BROWSER_SELECTION_COLOR : 'rgba(255, 255, 255, 0.15)'}`;
  ghost.style.cursor = isOverTarget ? 'copy' : 'no-drop';
}
