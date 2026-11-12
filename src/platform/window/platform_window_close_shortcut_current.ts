import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import { platformKeyboardModifierMapCreate } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import {
  PlatformWindowCloseShortcut,
  type PlatformWindowCloseTopmost,
} from '@/platform/window/platform_window_close_shortcut.js';

/**
 * Creates the close window shortcut of an operating system family: macOS closes
 * the front floating window with Command+W, other platforms keep the key for
 * the page.
 *
 * @param platformKind Operating system family.
 * @param closeTopmost Closes the topmost open floating window.
 * @returns Shortcut, or null on platforms without one.
 */
export function platformWindowCloseShortcutCreate(
  platformKind: PlatformKind,
  closeTopmost: PlatformWindowCloseTopmost,
): PlatformWindowCloseShortcut | null {
  if (platformKind !== 'mac') {
    return null;
  }
  return new PlatformWindowCloseShortcut(platformKeyboardModifierMapCreate(platformKind), closeTopmost);
}

/**
 * Creates the close window shortcut of the platform this page runs on.
 *
 * @param closeTopmost Closes the topmost open floating window.
 * @returns Shortcut, or null on platforms without one.
 */
export function platformWindowCloseShortcutCreateCurrent(
  closeTopmost: PlatformWindowCloseTopmost,
): PlatformWindowCloseShortcut | null {
  return platformWindowCloseShortcutCreate(platformKindRead(), closeTopmost);
}
