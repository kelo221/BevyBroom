import { THEME_LOOK_CURRENT } from '@/theme/theme_look_current.js';
import type { ThemeLook } from '@/theme/theme_look.js';
import { themeMacGlassStylesheetBuild } from '@/theme/mac_glass/theme_mac_glass_stylesheet.js';

/** Id of the style element that holds the stylesheet of the chrome look. */
export const THEME_LOOK_STYLE_ELEMENT_ID = 'theme-look-stylesheet';

/**
 * Builds the extra stylesheet of a chrome look; the classic look needs none.
 *
 * @param look Chrome look.
 * @returns CSS text, empty for the classic look.
 */
export function themeLookStylesheetBuild(look: ThemeLook): string {
  return look === 'mac_glass' ? themeMacGlassStylesheetBuild() : '';
}

/**
 * Marks the document with its chrome look and adds the look's stylesheet once.
 *
 * @param targetDocument Document that receives the look.
 * @param look Chrome look to install.
 */
export function themeLookInstall(targetDocument: Document, look: ThemeLook = THEME_LOOK_CURRENT): void {
  targetDocument.documentElement.dataset['themeLook'] = look;
  const cssText = themeLookStylesheetBuild(look);
  if (cssText === '' || targetDocument.getElementById(THEME_LOOK_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = targetDocument.createElement('style');
  styleElement.id = THEME_LOOK_STYLE_ELEMENT_ID;
  styleElement.textContent = cssText;
  targetDocument.head.appendChild(styleElement);
}
