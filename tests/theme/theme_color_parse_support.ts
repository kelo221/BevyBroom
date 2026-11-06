/** Red, green and blue channels of a parsed color, each from 0 to 255. */
export interface ThemeColorChannels {
  red: number;
  green: number;
  blue: number;
}

/** Matches `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` CSS hex colors. */
const CSS_HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Matches `rgb(r, g, b)` and `rgba(r, g, b, a)` CSS colors with channel
 * captures.
 */
const CSS_RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|1\.0+)\s*)?\)$/;

/**
 * Finds every embedded CSS color function inside a compound value such as a box
 * shadow.
 */
const CSS_EMBEDDED_RGB_PATTERN = /rgba?\([^)]*\)/g;

/**
 * Splits a 0xRRGGBB color number into channels.
 *
 * @param hex Color number.
 * @returns Channels.
 */
export function themeColorChannelsFromHex(hex: number): ThemeColorChannels {
  return { red: (hex >> 16) & 255, green: (hex >> 8) & 255, blue: hex & 255 };
}

/**
 * Sums the red, green and blue channels of a color number as a simple
 * brightness measure.
 *
 * @param hex Color number.
 * @returns Channel sum from 0 to 765.
 */
export function themeColorChannelSum(hex: number): number {
  const channels = themeColorChannelsFromHex(hex);
  return channels.red + channels.green + channels.blue;
}

/**
 * Parses a CSS hex color into channels, expanding short forms.
 *
 * @param css CSS hex color such as `#0078d7` or `#fff`.
 * @returns Channels, or null when the string is not a CSS hex color.
 */
function themeColorChannelsFromCssHex(css: string): ThemeColorChannels | null {
  if (!CSS_HEX_PATTERN.test(css)) {
    return null;
  }
  const digits = css.slice(1);
  const expanded = digits.length <= 4 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  return themeColorChannelsFromHex(parseInt(expanded.slice(0, 6), 16));
}

/**
 * Parses a CSS `rgb()` or `rgba()` color into channels.
 *
 * @param css CSS color function string.
 * @returns Channels, or null when the string is not a valid rgb color.
 */
function themeColorChannelsFromCssRgb(css: string): ThemeColorChannels | null {
  const match = CSS_RGB_PATTERN.exec(css);
  if (!match) {
    return null;
  }
  const channels = [match[1], match[2], match[3]].map((channel) => Number(channel));
  if (channels.some((channel) => channel > 255)) {
    return null;
  }
  const [red = 0, green = 0, blue = 0] = channels;
  return { red, green, blue };
}

/**
 * Parses a theme color token: a 0xRRGGBB number or a CSS hex / rgb(a) string.
 *
 * @param token Theme color token.
 * @returns Channels, or null when the token is not a valid color.
 */
export function themeColorTokenParse(token: number | string): ThemeColorChannels | null {
  if (typeof token === 'number') {
    const isColorNumber = Number.isInteger(token) && token >= 0 && token <= 0xffffff;
    return isColorNumber ? themeColorChannelsFromHex(token) : null;
  }
  const trimmed = token.trim();
  return themeColorChannelsFromCssHex(trimmed) ?? themeColorChannelsFromCssRgb(trimmed);
}

/**
 * Returns every CSS color function embedded in a compound CSS value.
 *
 * @param css Compound CSS value such as a box shadow.
 * @returns Embedded `rgb()` / `rgba()` substrings.
 */
export function themeEmbeddedColorsRead(css: string): string[] {
  return css.match(CSS_EMBEDDED_RGB_PATTERN) ?? [];
}

/**
 * Converts one 0-255 sRGB channel to linear light per WCAG 2.
 *
 * @param channel Channel value from 0 to 255.
 * @returns Linear channel from 0 to 1.
 */
function themeChannelLinearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Returns the WCAG 2 relative luminance of a color.
 *
 * @param channels Color channels.
 * @returns Relative luminance from 0 (black) to 1 (white).
 */
export function themeRelativeLuminance(channels: ThemeColorChannels): number {
  const red = themeChannelLinearize(channels.red);
  const green = themeChannelLinearize(channels.green);
  const blue = themeChannelLinearize(channels.blue);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Returns the WCAG 2 contrast ratio of two colors.
 *
 * @param first First color.
 * @param second Second color.
 * @returns Contrast ratio from 1 to 21.
 */
export function themeContrastRatio(first: ThemeColorChannels, second: ThemeColorChannels): number {
  const firstLuminance = themeRelativeLuminance(first);
  const secondLuminance = themeRelativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
