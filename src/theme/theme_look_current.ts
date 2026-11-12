import { platformKindRead } from '@/platform/platform_kind.js';
import { THEME_LOOK_STORAGE_KEY } from '@/settings/storage/settings_storage_keys.js';
import { THEME_LOOK_STORED_SYSTEM, themeLookResolve, type ThemeLook } from '@/theme/theme_look.js';

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

/**
 * Returns whether the system appearance is dark, or false when the browser
 * cannot tell.
 *
 * @returns True in dark mode.
 */
export function themeLookSystemDarkRead(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Chrome look of this page, fixed for its lifetime. */
export const THEME_LOOK_CURRENT: ThemeLook = themeLookResolve(
  platformKindRead(),
  themeLookStoredRead(),
  themeLookSystemDarkRead(),
);

/**
 * Returns the look value saved by the user, or null when none is saved.
 *
 * @returns Saved look value, such as a look id or "system".
 */
export function themeLookStoredValueRead(): string | null {
  return themeLookStoredRead();
}

/**
 * Saves the chrome look used from the next start on.
 *
 * @param look Look to save, or "system" to follow the system appearance.
 */
export function themeLookSave(look: ThemeLook | typeof THEME_LOOK_STORED_SYSTEM): void {
  try {
    localStorage.setItem(THEME_LOOK_STORAGE_KEY, look);
  } catch {
    return;
  }
}
