import { ThemePaletteHammer, type ThemePalette } from '@/theme/theme_palette_hammer.js';
import { ThemePaletteMacGlass } from '@/theme/theme_palette_mac_glass.js';
import { ThemePaletteMacGlassDark } from '@/theme/theme_palette_mac_glass_dark.js';
import { THEME_LOOK_CURRENT } from '@/theme/theme_look_current.js';
import type { ThemeLook } from '@/theme/theme_look.js';

/**
 * Returns the palette of a chrome look.
 *
 * @param look Chrome look.
 * @returns Frozen palette of that look.
 */
export function themePaletteForLook(look: ThemeLook): ThemePalette {
  return THEME_PALETTES_BY_LOOK[look];
}

/** Palette of every chrome look. */
const THEME_PALETTES_BY_LOOK: Readonly<Record<ThemeLook, ThemePalette>> = Object.freeze({
  classic: ThemePaletteHammer,
  mac_glass: ThemePaletteMacGlass,
  mac_glass_dark: ThemePaletteMacGlassDark,
});

/**
 * Editor theme tokens of the chrome look this page started with: the classic
 * Hammer++ palette, or the macOS glass palette on macOS. Frozen so runtime code
 * cannot mutate shared palette values.
 */
export const Theme: ThemePalette = themePaletteForLook(THEME_LOOK_CURRENT);
