import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { faceInspectorPreviewImageWrite } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import {
  MATERIAL_BROWSER_NAME_CLASS,
  MATERIAL_BROWSER_THUMB_CLASS,
  MATERIAL_BROWSER_TILE_CLASS,
} from './material_browser_styles.js';

/** Background of a selected tile (selection orange, translucent). */
const MATERIAL_BROWSER_TILE_SELECTED_BACKGROUND = 'rgba(232, 106, 23, 0.22)';

/**
 * Creates a material tile with a square preview and the name below it.
 *
 * @param entry Material entry.
 * @param onSelect Called with the entry id on click, Enter or Space.
 * @returns Tile element.
 */
export function materialBrowserTileCreate(
  entry: TextureBrowserEntry,
  onSelect: (entryId: string) => void,
): HTMLElement {
  const tile = document.createElement('div');
  tile.className = MATERIAL_BROWSER_TILE_CLASS;
  tile.setAttribute('role', 'option');
  tile.setAttribute('aria-label', entry.id);
  tile.tabIndex = 0;
  tile.dataset['entryId'] = entry.id;
  tile.title = entry.relativePath;
  tile.style.borderRadius = '2px';
  tile.append(materialBrowserTileThumbCreate(entry), materialBrowserTileNameCreate(entry.displayName));
  materialBrowserTileSelectBind(tile, entry.id, onSelect);
  materialBrowserTileSelectionPaint(tile, false);
  return tile;
}

/**
 * Paints a tile as selected (orange) or idle.
 *
 * @param tile Tile element.
 * @param selected Whether the tile is selected.
 */
export function materialBrowserTileSelectionPaint(tile: HTMLElement, selected: boolean): void {
  tile.style.border = selected ? `1px solid ${hexToRgb(Theme.selectionColor)}` : `1px solid ${Theme.inputBorderColor}`;
  tile.style.background = selected ? MATERIAL_BROWSER_TILE_SELECTED_BACKGROUND : hexToRgb(Theme.buttonBackground);
  tile.setAttribute('aria-selected', selected ? 'true' : 'false');
}

/**
 * Selects the tile's entry on click and on Enter or Space.
 *
 * @param tile Tile element.
 * @param entryId Entry id of the tile.
 * @param onSelect Selection callback.
 */
function materialBrowserTileSelectBind(tile: HTMLElement, entryId: string, onSelect: (entryId: string) => void): void {
  tile.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(entryId);
  });
  tile.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(entryId);
  });
}

/**
 * Creates the square preview whose height comes from the stylesheet.
 *
 * @param entry Material entry with its preview URL.
 * @returns Thumbnail element.
 */
function materialBrowserTileThumbCreate(entry: TextureBrowserEntry): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = MATERIAL_BROWSER_THUMB_CLASS;
  thumb.dataset['previewThumb'] = 'true';
  thumb.setAttribute('role', 'img');
  thumb.setAttribute('aria-label', entry.displayName);
  faceInspectorPreviewImageWrite(thumb, entry.previewObjectUrl);
  return thumb;
}

/**
 * Creates the name label under a thumbnail.
 *
 * @param displayName Material display name.
 * @returns Name element.
 */
function materialBrowserTileNameCreate(displayName: string): HTMLElement {
  const name = document.createElement('span');
  name.className = MATERIAL_BROWSER_NAME_CLASS;
  name.textContent = displayName;
  name.style.color = Theme.buttonTextColor;
  return name;
}
