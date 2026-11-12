import type { PlatformKind } from '@/platform/platform_kind.js';

/**
 * Chrome look of the editor: classic Hammer++, or light or dark translucent
 * macOS glass.
 */
export type ThemeLook = 'classic' | 'mac_glass' | 'mac_glass_dark';

/** Stored look value that follows the system light or dark appearance. */
export const THEME_LOOK_STORED_SYSTEM = 'system';

/** Every chrome look in menu order. */
export const THEME_LOOKS: readonly ThemeLook[] = Object.freeze(['classic', 'mac_glass', 'mac_glass_dark']);

/**
 * Returns whether a stored value names a known chrome look.
 *
 * @param storedValue Value read from storage, or null.
 * @returns True for a known look.
 */
export function themeLookIsKnown(storedValue: string | null): storedValue is ThemeLook {
  return storedValue !== null && (THEME_LOOKS as readonly string[]).includes(storedValue);
}

/**
 * Picks the chrome look: a stored look wins; otherwise, or when the stored
 * value asks to follow the system, macOS gets the light or dark glass look
 * matching the system appearance and every other platform keeps the classic
 * look.
 *
 * @param platformKind Operating system family.
 * @param storedValue Look saved by the user, or null.
 * @param isSystemDark Whether the system appearance is dark.
 * @returns Chrome look to use.
 */
export function themeLookResolve(
  platformKind: PlatformKind,
  storedValue: string | null,
  isSystemDark: boolean,
): ThemeLook {
  if (themeLookIsKnown(storedValue)) {
    return storedValue;
  }
  if (platformKind !== 'mac') {
    return 'classic';
  }
  return isSystemDark ? 'mac_glass_dark' : 'mac_glass';
}
