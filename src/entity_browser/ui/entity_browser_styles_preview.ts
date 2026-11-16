import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Share of the browser height the single 3D tile takes, in percent. */
const ENTITY_BROWSER_PREVIEW_PANE_HEIGHT_PERCENT = 58;

/** Smallest height of the single 3D tile in CSS pixels. */
const ENTITY_BROWSER_PREVIEW_PANE_MIN_HEIGHT_PX = 140;

/**
 * Styles a rendered 3D image so it fills its thumbnail square.
 *
 * @param image Image element.
 */
export function entityBrowserStyleThumbnailImage(image: HTMLElement): void {
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.borderRadius = '4px';
  image.style.objectFit = 'cover';
  image.style.pointerEvents = 'none';
}

/**
 * Styles the single 3D tile: a mid grey 3D view box above the tile grid.
 *
 * @param pane Pane element.
 */
export function entityBrowserStylePreviewPane(pane: HTMLElement): void {
  pane.style.position = 'relative';
  pane.style.flex = `0 0 ${ENTITY_BROWSER_PREVIEW_PANE_HEIGHT_PERCENT}%`;
  pane.style.minHeight = `${ENTITY_BROWSER_PREVIEW_PANE_MIN_HEIGHT_PX}px`;
  pane.style.overflow = 'hidden';
  pane.style.background = hexToRgb(Theme.viewportBackground);
  pane.style.borderBottom = `1px solid ${Theme.statusBarBorderColor}`;
  pane.style.cursor = 'grab';
  pane.style.touchAction = 'none';
}

/**
 * Styles the canvas of the single 3D tile so it fills the pane.
 *
 * @param canvas Canvas element.
 */
export function entityBrowserStylePreviewCanvas(canvas: HTMLElement): void {
  canvas.style.position = 'absolute';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
}

/**
 * Styles the corner label of the single 3D tile, like the viewport corner
 * labels.
 *
 * @param caption Caption element.
 */
export function entityBrowserStylePreviewCaption(caption: HTMLElement): void {
  caption.style.position = 'absolute';
  caption.style.left = '4px';
  caption.style.top = '4px';
  caption.style.padding = '1px 5px';
  caption.style.borderRadius = '2px';
  caption.style.background = Theme.viewportLabelBackgroundColor;
  caption.style.color = Theme.viewportLabelTextColor;
  caption.style.fontSize = '11px';
  caption.style.pointerEvents = 'none';
}

/**
 * Styles the centred message shown when the single 3D tile has nothing to draw.
 *
 * @param message Message element.
 */
export function entityBrowserStylePreviewMessage(message: HTMLElement): void {
  message.style.position = 'absolute';
  message.style.inset = '0';
  message.style.display = 'flex';
  message.style.alignItems = 'center';
  message.style.justifyContent = 'center';
  message.style.color = Theme.viewportLabelTextColor;
  message.style.fontSize = '11px';
  message.style.pointerEvents = 'none';
}
