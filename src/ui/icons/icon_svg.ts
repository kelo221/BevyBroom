import type { IconName } from '@/ui/icons/icon_name.js';
import { ICON_GRID_SIZE, IconRegistry } from '@/ui/icons/icon_registry.js';

/** Default pixel size of inline icons in menus, rows and headers. */
export const ICON_SVG_DEFAULT_SIZE_PX = 14;

/**
 * Builds the inline SVG markup of an icon.
 *
 * @param iconName Icon name.
 * @param sizePx Width and height in pixels.
 * @param color CSS fill color; omitted icons use the text color.
 * @returns SVG element markup.
 */
export function iconSvgMarkup(iconName: IconName, sizePx: number = ICON_SVG_DEFAULT_SIZE_PX, color?: string): string {
  const fill = color ?? 'currentColor';
  const viewBox = `0 0 ${ICON_GRID_SIZE} ${ICON_GRID_SIZE}`;
  const path = `<path fill="${fill}" d="${IconRegistry.pathOf(iconName)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="${viewBox}" aria-hidden="true">${path}</svg>`;
}

/**
 * Creates an inline-flex span holding an icon, sized for a text row.
 *
 * @param ownerDocument Document that owns the element.
 * @param iconName Icon name.
 * @param sizePx Width and height in pixels.
 * @param color CSS fill color; omitted icons use the text color.
 * @returns Icon span element.
 */
export function iconSvgElementCreate(
  ownerDocument: Document,
  iconName: IconName,
  sizePx: number = ICON_SVG_DEFAULT_SIZE_PX,
  color?: string,
): HTMLSpanElement {
  const element = ownerDocument.createElement('span');
  element.classList.add('editor-icon');
  element.dataset['icon'] = iconName;
  element.style.display = 'inline-flex';
  element.style.alignItems = 'center';
  element.style.flex = '0 0 auto';
  element.innerHTML = iconSvgMarkup(iconName, sizePx, color);
  return element;
}
