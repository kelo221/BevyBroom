import type { PlatformKind } from '@/platform/platform_kind.js';

/** Chrome look of the editor: classic Hammer++ or translucent macOS glass. */
export type ThemeLook = 'classic' | 'mac_glass';

/** Every chrome look in menu order. */
export const THEME_LOOKS: readonly ThemeLook[] = Object.freeze(['classic', 'mac_glass']);

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
 * Picks the chrome look: a stored choice wins, otherwise macOS gets the glass
 * look and every other platform keeps the classic look.
 *
 * @param platformKind Operating system family.
 * @param storedValue Look saved by the user, or null.
 * @returns Chrome look to use.
 */
export function themeLookResolve(platformKind: PlatformKind, storedValue: string | null): ThemeLook {
  if (themeLookIsKnown(storedValue)) {
    return storedValue;
  }
  return platformKind === 'mac' ? 'mac_glass' : 'classic';
}
