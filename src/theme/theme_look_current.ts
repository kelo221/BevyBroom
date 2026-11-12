import { platformKindRead } from '@/platform/platform_kind.js';
import { THEME_LOOK_STORAGE_KEY } from '@/settings/storage/settings_storage_keys.js';
import { themeLookResolve, type ThemeLook } from '@/theme/theme_look.js';

/**
 * Reads the saved chrome look from browser storage, or null when storage is
 * missing or blocked.
 *
 * @returns Saved look string, or null.
 */
function themeLookStoredRead(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_LOOK_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Chrome look of this page, fixed for its lifetime. */
export const THEME_LOOK_CURRENT: ThemeLook = themeLookResolve(platformKindRead(), themeLookStoredRead());

/**
 * Saves the chrome look used from the next start on.
 *
 * @param look Look to save.
 */
export function themeLookSave(look: ThemeLook): void {
  try {
    localStorage.setItem(THEME_LOOK_STORAGE_KEY, look);
  } catch {
    return;
  }
}
