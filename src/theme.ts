import { ThemePaletteHammer, type ThemePalette } from '@/theme/theme_palette_hammer.js';
import { ThemePaletteMacGlass } from '@/theme/theme_palette_mac_glass.js';
import { THEME_LOOK_CURRENT } from '@/theme/theme_look_current.js';
import type { ThemeLook } from '@/theme/theme_look.js';

/**
 * Returns the palette of a chrome look.
 *
 * @param look Chrome look.
 * @returns Frozen palette of that look.
 */
export function themePaletteForLook(look: ThemeLook): ThemePalette {
  return look === 'mac_glass' ? ThemePaletteMacGlass : ThemePaletteHammer;
}

/**
 * Editor theme tokens of the chrome look this page started with: the classic
 * Hammer++ palette, or the macOS glass palette on macOS. Frozen so runtime code
 * cannot mutate shared palette values.
 */
export const Theme: ThemePalette = themePaletteForLook(THEME_LOOK_CURRENT);
