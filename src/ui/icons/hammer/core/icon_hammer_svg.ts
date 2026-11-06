/** Edge length of the square grid every classic Hammer icon is drawn on. */
export const ICON_HAMMER_GRID_SIZE = 32;

/**
 * Wraps icon markup in a sized SVG element on the 32 by 32 icon grid.
 *
 * @param iconName Icon name written to the `data-icon-hammer` attribute.
 * @param content Inner markup of the icon.
 * @param sizePx Rendered width and height in pixels.
 * @returns Complete SVG element markup.
 */
export function iconHammerSvgWrap(iconName: string, content: string, sizePx: number): string {
  const viewBox = `0 0 ${ICON_HAMMER_GRID_SIZE} ${ICON_HAMMER_GRID_SIZE}`;
  const attributes = `width="${sizePx}" height="${sizePx}" viewBox="${viewBox}" aria-hidden="true" data-icon-hammer="${iconName}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${content}</svg>`;
}
