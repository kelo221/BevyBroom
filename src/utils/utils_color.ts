/** Largest 0xRRGGBB color number. */
export const COLOR_HEX_MAXIMUM = 0xffffff;

/**
 * Converts a hex color number to an RGB CSS string.
 *
 * @param hex The hex color value as a number.
 * @returns An RGB CSS color string.
 */
export function hexToRgb(hex: number): string {
  return `rgb(${hexChannelsCss(hex)})`;
}

/**
 * Converts a hex color number and an alpha value to an RGBA CSS string.
 *
 * @param hex The hex color value as a number.
 * @param alpha Opacity from 0 (transparent) to 1 (opaque).
 * @returns An RGBA CSS color string.
 */
export function hexToRgba(hex: number, alpha: number): string {
  return `rgba(${hexChannelsCss(hex)}, ${alpha})`;
}

/**
 * Splits a hex color number into comma separated red, green and blue channels.
 *
 * @param hex The hex color value as a number.
 * @returns Channels as `r, g, b` with values from 0 to 255.
 */
function hexChannelsCss(hex: number): string {
  return `${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}`;
}

/**
 * Converts a hex color number to the `#rrggbb` form color inputs require,
 * clamping it into the valid color range first.
 *
 * @param hex The hex color value as a number.
 * @returns Lowercase `#rrggbb` string.
 */
export function hexToCssHex(hex: number): string {
  const clamped = Math.max(0, Math.min(COLOR_HEX_MAXIMUM, Math.round(hex)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

/**
 * Converts a theme color token, either a hex number or a CSS color string, to a
 * CSS color string.
 *
 * @param token Hex color number or CSS color string.
 * @returns CSS color string.
 */
export function colorTokenCss(token: number | string): string {
  return typeof token === 'number' ? hexToRgb(token) : token;
}
