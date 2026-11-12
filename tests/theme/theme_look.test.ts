import { describe, expect, it } from 'vitest';
import { THEME_LOOKS, themeLookIsKnown, themeLookResolve } from '@/theme/theme_look.js';
import { themePaletteForLook } from '@/theme.js';
import { ThemePaletteHammer } from '@/theme/theme_palette_hammer.js';

describe('theme look', () => {
  it('gives macOS the glass look and keeps the classic look on every other platform', () => {
    expect(themeLookResolve('mac', null)).toBe('mac_glass');
    expect(themeLookResolve('windows', null)).toBe('classic');
    expect(themeLookResolve('linux', null)).toBe('classic');
    expect(themeLookResolve('other', null)).toBe('classic');
  });

  it('lets a saved choice win and ignores unknown saved values', () => {
    expect(themeLookResolve('mac', 'classic')).toBe('classic');
    expect(themeLookResolve('windows', 'mac_glass')).toBe('mac_glass');
    expect(themeLookResolve('mac', 'neon')).toBe('mac_glass');
    expect(themeLookIsKnown('neon')).toBe(false);
  });

  it('keeps the classic palette for the classic look and gives every look a frozen palette', () => {
    expect(themePaletteForLook('classic')).toBe(ThemePaletteHammer);
    for (const look of THEME_LOOKS) {
      expect(Object.isFrozen(themePaletteForLook(look))).toBe(true);
    }
  });

  it('gives the glass palette every token of the classic palette with translucent rounded chrome', () => {
    const glass = themePaletteForLook('mac_glass');
    expect(Object.keys(glass).sort()).toEqual(Object.keys(ThemePaletteHammer).sort());
    expect(glass.windowRadiusPx).toBeGreaterThan(ThemePaletteHammer.windowRadiusPx);
    expect(glass.glassBackdropFilter).toContain('blur');
    expect(ThemePaletteHammer.glassBackdropFilter).toBe('none');
    expect(glass.selectionColor).toBe(ThemePaletteHammer.selectionColor);
  });
});
