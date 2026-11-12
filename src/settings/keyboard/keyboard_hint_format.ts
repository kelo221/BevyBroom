import type {
  PlatformKeyboardModifierMap,
  PlatformKeyboardModifierName,
} from '@/platform/keyboard/platform_keyboard_modifier_map.js';
import { PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import type { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';
import { PLATFORM_KEYBOARD_KEY_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_key_map_current.js';

/** Placeholder of a modifier name inside a hint template, such as "{ctrl}". */
const KEYBOARD_HINT_MODIFIER_TOKEN_PATTERN = /\{(ctrl|shift|alt|meta)\}/g;

/** Placeholder of the physical Control key inside a hint template. */
const KEYBOARD_HINT_CONTROL_KEY_TOKEN_PATTERN = /\{control\}/g;

/**
 * Placeholder of a short key label inside a hint template, such as
 * "{key:Delete}".
 */
const KEYBOARD_HINT_KEY_TOKEN_PATTERN = /\{key:([A-Za-z0-9]+)\}/g;

/** Placeholder of a key name inside a sentence, such as "{keyname:Delete}". */
const KEYBOARD_HINT_KEY_NAME_TOKEN_PATTERN = /\{keyname:([A-Za-z0-9]+)\}/g;

/**
 * Fills the modifier and key placeholders of a hint template with the names of
 * the current platform: "{ctrl}+click" reads "Ctrl+click" on Windows and Linux
 * and "⌘+click" on macOS, "{control}" names the physical Control key ("Ctrl" or
 * "⌃"), "{key:Delete}" reads "Del" or "⌦", "{keyname:Delete}" reads "Delete" or
 * "⌦".
 *
 * @param template Hint text with "{ctrl}", "{shift}", "{alt}", "{meta}",
 *   "{control}", "{key:Code}" and "{keyname:Code}" placeholders.
 * @param modifierMap Modifier map naming the modifiers; defaults to the map of
 *   the platform this page runs on.
 * @param keyMap Key map labelling the keys; defaults to the map of the platform
 *   this page runs on.
 * @returns Hint text for the platform.
 */
export function keyboardHintFormat(
  template: string,
  modifierMap: PlatformKeyboardModifierMap = PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT,
  keyMap: PlatformKeyboardKeyMap = PLATFORM_KEYBOARD_KEY_MAP_CURRENT,
): string {
  return template
    .replace(KEYBOARD_HINT_CONTROL_KEY_TOKEN_PATTERN, () => modifierMap.controlKeyLabel())
    .replace(KEYBOARD_HINT_MODIFIER_TOKEN_PATTERN, (_match, modifier: string) =>
      modifierMap.modifierLabel(modifier as PlatformKeyboardModifierName),
    )
    .replace(KEYBOARD_HINT_KEY_TOKEN_PATTERN, (_match, code: string) => keyMap.keyLabel(code))
    .replace(KEYBOARD_HINT_KEY_NAME_TOKEN_PATTERN, (_match, code: string) => keyMap.keyName(code));
}
