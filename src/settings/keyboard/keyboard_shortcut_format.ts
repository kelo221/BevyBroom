import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';

/**
 * Converts a shortcut binding to a short UI label in the style of the current
 * platform, such as "Ctrl+Shift+E" or "⇧⌘E".
 *
 * @param shortcut Configured key and modifiers.
 * @returns User-facing shortcut label.
 */
export function formatKeyboardShortcut(shortcut: KeyboardShortcut): string {
  return PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT.labelFormat(shortcut, formatKeyboardCode(shortcut.code));
}

/**
 * Converts a KeyboardEvent.code value to a short UI label.
 *
 * @param code Keyboard event code.
 * @returns User-facing key label.
 */
export function formatKeyboardCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Delete') return 'Del';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backquote') return '`';
  return code;
}
