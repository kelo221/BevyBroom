import { describe, expect, it } from 'vitest';
import { THEME_LOOKS, themeLookIsKnown, themeLookResolve } from '@/theme/theme_look.js';
import { themePaletteForLook } from '@/theme.js';
import { ThemePaletteHammer } from '@/theme/theme_palette_hammer.js';
import { themeColorTokenParse, themeRelativeLuminance } from './theme_color_parse_support.js';

describe('theme look', () => {
  it('gives macOS the glass look matching the system appearance and keeps classic elsewhere', () => {
    expect(themeLookResolve('mac', null, false)).toBe('mac_glass');
    expect(themeLookResolve('mac', null, true)).toBe('mac_glass_dark');
    for (const isSystemDark of [false, true]) {
      expect(themeLookResolve('windows', null, isSystemDark)).toBe('classic');
      expect(themeLookResolve('linux', null, isSystemDark)).toBe('classic');
      expect(themeLookResolve('other', null, isSystemDark)).toBe('classic');
    }
  });

  it('lets a saved look win, follows the system for "system", and ignores unknown values', () => {
    expect(themeLookResolve('mac', 'classic', true)).toBe('classic');
    expect(themeLookResolve('mac', 'mac_glass', true)).toBe('mac_glass');
    expect(themeLookResolve('windows', 'mac_glass_dark', false)).toBe('mac_glass_dark');
    expect(themeLookResolve('mac', 'system', true)).toBe('mac_glass_dark');
    expect(themeLookResolve('mac', 'neon', false)).toBe('mac_glass');
    expect(themeLookIsKnown('system')).toBe(false);
  });

  it('keeps the classic palette for the classic look and gives every look its own frozen palette', () => {
    expect(themePaletteForLook('classic')).toBe(ThemePaletteHammer);
    const palettes = THEME_LOOKS.map(themePaletteForLook);
    expect(new Set(palettes).size).toBe(THEME_LOOKS.length);
    palettes.forEach((palette) => expect(Object.isFrozen(palette)).toBe(true));
  });

  it('gives the glass palettes every classic token with translucent rounded chrome and the classic selection color', () => {
    for (const look of ['mac_glass', 'mac_glass_dark'] as const) {
      const glass = themePaletteForLook(look);
      expect(Object.keys(glass).sort()).toEqual(Object.keys(ThemePaletteHammer).sort());
      expect(glass.windowRadiusPx).toBeGreaterThan(ThemePaletteHammer.windowRadiusPx);
      expect(glass.glassBackdropFilter).toContain('blur');
      expect(glass.selectionColor).toBe(ThemePaletteHammer.selectionColor);
    }
    expect(ThemePaletteHammer.glassBackdropFilter).toBe('none');
  });

  it('draws the dark glass chrome dark with light text, and the light glass chrome the other way round', () => {
    const lightness = (token: number | string) => {
      const channels = themeColorTokenParse(token);
      return channels ? themeRelativeLuminance(channels) : 0;
    };
    const dark = themePaletteForLook('mac_glass_dark');
    const light = themePaletteForLook('mac_glass');
    expect(lightness(dark.toolbarBackground)).toBeLessThan(lightness(light.toolbarBackground));
    expect(lightness(dark.buttonTextColor)).toBeGreaterThan(lightness(light.buttonTextColor));
  });
});
