import { describe, it, expect } from 'vitest';
import { COLOR_HEX_MAXIMUM, colorTokenCss, hexToCssHex, hexToRgb, hexToRgba } from '@/utils/utils_color.js';

/**
 * Builds a color number from channels.
 *
 * @param red Red channel from 0 to 255.
 * @param green Green channel from 0 to 255.
 * @param blue Blue channel from 0 to 255.
 * @returns 0xRRGGBB color number.
 */
function colorNumberFromChannels(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}

/** Unit tests for the color conversion helpers. */
describe('utils_color', () => {
  const red = Math.floor(Math.random() * 256);
  const green = Math.floor(Math.random() * 256);
  const blue = Math.floor(Math.random() * 256);
  const hex = colorNumberFromChannels(red, green, blue);

  it('converts a color number to an rgb CSS string', () => {
    expect(hexToRgb(hex)).toBe(`rgb(${red}, ${green}, ${blue})`);
  });

  it('converts a color number and alpha to an rgba CSS string', () => {
    const alpha = Math.round(Math.random() * 100) / 100;
    expect(hexToRgba(hex, alpha)).toBe(`rgba(${red}, ${green}, ${blue}, ${alpha})`);
  });

  it('writes six lowercase hex digits and clamps out-of-range numbers', () => {
    const css = hexToCssHex(hex);
    expect(css).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseInt(css.slice(1), 16)).toBe(hex);
    expect(hexToCssHex(COLOR_HEX_MAXIMUM + 1000)).toBe(hexToCssHex(COLOR_HEX_MAXIMUM));
    expect(hexToCssHex(-5)).toBe(hexToCssHex(0));
  });

  it('passes CSS string tokens through and converts number tokens', () => {
    const cssToken = hexToRgba(hex, 0.5);
    expect(colorTokenCss(cssToken)).toBe(cssToken);
    expect(colorTokenCss(hex)).toBe(hexToRgb(hex));
  });
});
