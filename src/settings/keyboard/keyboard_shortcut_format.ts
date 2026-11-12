import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import { PLATFORM_KEYBOARD_KEY_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_key_map_current.js';
import type { PlatformKeyboardModifierMap } from '@/platform/keyboard/platform_keyboard_modifier_map.js';
import type { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';

/**
 * Converts a shortcut binding to a short UI label in the style of the current
 * platform, such as "Ctrl+Shift+E" or "⇧⌘E".
 *
 * @param shortcut Configured key and modifiers.
 * @returns User-facing shortcut label.
 */
export function formatKeyboardShortcut(shortcut: KeyboardShortcut): string {
  return formatKeyboardShortcutForPlatform(
    shortcut,
    PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT,
    PLATFORM_KEYBOARD_KEY_MAP_CURRENT,
  );
}

/**
 * Converts a shortcut binding to a short UI label in the style of a given
 * platform.
 *
 * @param shortcut Configured key and modifiers.
 * @param modifierMap Modifier map of the platform.
 * @param keyMap Key map of the platform.
 * @returns User-facing shortcut label.
 */
export function formatKeyboardShortcutForPlatform(
  shortcut: KeyboardShortcut,
  modifierMap: PlatformKeyboardModifierMap,
  keyMap: PlatformKeyboardKeyMap,
): string {
  return modifierMap.labelFormat(shortcut, keyMap.keyLabel(shortcut.code));
}

/**
 * Converts a KeyboardEvent.code value to a short UI label in the style of the
 * current platform, such as "Del" or "⌦".
 *
 * @param code Keyboard event code.
 * @returns User-facing key label.
 */
export function formatKeyboardCode(code: string): string {
  return PLATFORM_KEYBOARD_KEY_MAP_CURRENT.keyLabel(code);
}
