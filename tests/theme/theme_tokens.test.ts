import { beforeAll, describe, it, expect } from 'vitest';
import { themePaletteForLook } from '@/theme.js';
import { THEME_LOOKS } from '@/theme/theme_look.js';
import type { ThemePalette } from '@/theme/theme_palette_hammer.js';
import {
  themeColorTokenParse,
  themeContrastRatio,
  themeEmbeddedColorsRead,
  type ThemeColorChannels,
} from './theme_color_parse_support.js';

/** Minimum WCAG contrast ratio of normal-size chrome text. */
const THEME_TEXT_CONTRAST_MINIMUM = 4.5;

/** Name suffixes of theme tokens that hold sizes instead of colors. */
const THEME_LAYOUT_TOKEN_SUFFIX = 'Px';

/** Name suffix of theme tokens that hold font stacks instead of colors. */
const THEME_FONT_TOKEN_SUFFIX = 'FontFamily';

/** Name suffix of theme tokens that hold CSS filters instead of colors. */
const THEME_FILTER_TOKEN_SUFFIX = 'Filter';

/** Palette of the chrome look under test; replaced before each look's tests run. */
let Theme: ThemePalette = themePaletteForLook('classic');

/** Name suffix of theme tokens that hold CSS box shadows with embedded colors. */
const THEME_SHADOW_TOKEN_SUFFIX = 'Shadow';

/** Name of the per-object 2D wire palette token. */
const THEME_WIRE_PALETTE_TOKEN = 'objectWirePalette';

/** Name suffix of theme tokens that hold a group of named colors. */
const THEME_COLOR_GROUP_TOKEN_SUFFIX = 'Colors';

/** Minimum WCAG contrast ratio of icons and other non-text graphics. */
const THEME_GRAPHIC_CONTRAST_MINIMUM = 3;

/**
 * Returns the names of every theme token that holds a single color.
 *
 * @returns Color token names.
 */
function themeColorTokenNamesRead(): string[] {
  return Object.keys(Theme).filter(
    (name) =>
      !name.endsWith(THEME_LAYOUT_TOKEN_SUFFIX) &&
      !name.endsWith(THEME_FONT_TOKEN_SUFFIX) &&
      !name.endsWith(THEME_SHADOW_TOKEN_SUFFIX) &&
      !name.endsWith(THEME_FILTER_TOKEN_SUFFIX) &&
      !name.endsWith(THEME_COLOR_GROUP_TOKEN_SUFFIX) &&
      name !== THEME_WIRE_PALETTE_TOKEN,
  );
}

/**
 * Reads a theme token by name as an untyped value.
 *
 * @param name Token name.
 * @returns Token value.
 */
function themeTokenRead(name: string): unknown {
  return (Theme as Readonly<Record<string, unknown>>)[name];
}

/**
 * Parses a theme token that must be a color, failing the test when it is not.
 *
 * @param token Theme color token.
 * @returns Parsed channels.
 */
function themeColorTokenParseRequired(token: number | string): ThemeColorChannels {
  const channels = themeColorTokenParse(token);
  if (!channels) {
    throw new Error(`theme token ${String(token)} is not a color`);
  }
  return channels;
}

/**
 * Unit tests proving every theme color token of every chrome look is valid and
 * chrome text stays readable.
 */
describe.each(THEME_LOOKS)('Theme tokens of the %s look', (look) => {
  beforeAll(() => {
    Theme = themePaletteForLook(look);
  });

  it('parses every single-color token as a hex number or CSS color', () => {
    const names = themeColorTokenNamesRead();
    expect(names.length).toBeGreaterThan(0);
    const invalid = names.filter((name) => {
      const value = themeTokenRead(name);
      if (typeof value !== 'number' && typeof value !== 'string') return true;
      return themeColorTokenParse(value) === null;
    });
    expect(invalid).toEqual([]);
  });

  it('parses every color embedded in shadow tokens', () => {
    const shadowNames = Object.keys(Theme).filter((name) => name.endsWith(THEME_SHADOW_TOKEN_SUFFIX));
    expect(shadowNames.length).toBeGreaterThan(0);
    shadowNames.forEach((name) => {
      const embedded = themeEmbeddedColorsRead(String(themeTokenRead(name)));
      expect(embedded.length, name).toBeGreaterThan(0);
      embedded.forEach((color) => expect(themeColorTokenParse(color), `${name}: ${color}`).not.toBeNull());
    });
  });

  it('parses every member of the named color group tokens', () => {
    const groupNames = Object.keys(Theme).filter((name) => name.endsWith(THEME_COLOR_GROUP_TOKEN_SUFFIX));
    expect(groupNames.length).toBeGreaterThan(0);
    groupNames.forEach((name) => {
      const members = Object.entries(themeTokenRead(name) as Readonly<Record<string, string>>);
      expect(members.length, name).toBeGreaterThan(0);
      members.forEach(([member, color]) => expect(themeColorTokenParse(color), `${name}.${member}`).not.toBeNull());
    });
  });

  it('keeps every outliner object type glyph visible on the outliner background', () => {
    const background = themeColorTokenParseRequired(Theme.outlinerBackground);
    Object.entries(Theme.outlinerIconColors).forEach(([member, color]) => {
      const contrast = themeContrastRatio(themeColorTokenParseRequired(color), background);
      expect(contrast, member).toBeGreaterThanOrEqual(THEME_GRAPHIC_CONTRAST_MINIMUM);
    });
  });

  it('holds only valid, distinct colors in the 2D wire palette', () => {
    const palette = Theme.objectWirePalette;
    expect(palette.length).toBeGreaterThan(1);
    palette.forEach((color) => expect(themeColorTokenParse(color)).not.toBeNull());
    expect(new Set(palette).size).toBe(palette.length);
  });

  it('keeps no wire palette color equal to the selection or 2D background color', () => {
    expect(Theme.objectWirePalette).not.toContain(Theme.selectionColor);
    expect(Theme.objectWirePalette).not.toContain(Theme.viewport2dBackground);
  });

  it.each([
    ['buttonTextColor', 'buttonBackground'],
    ['inputTextColor', 'inputBackgroundColor'],
    ['statusBarTextColor', 'statusBarBackground'],
    ['menuHighlightTextColor', 'menuHighlightBackground'],
  ] as const)('keeps %s readable on %s', (textName, backgroundName) => {
    const text = themeColorTokenParseRequired(Theme[textName]);
    const background = themeColorTokenParseRequired(Theme[backgroundName]);
    expect(themeContrastRatio(text, background)).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST_MINIMUM);
  });
});
