import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import type { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';
import { PLATFORM_KEYBOARD_KEY_MAP_CURRENT } from '@/platform/keyboard/platform_keyboard_key_map_current.js';

/** Native key names of keyboard event codes that are not letters or digits. */
const NATIVE_MENU_ACCELERATOR_KEY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'return',
  NumpadEnter: 'return',
  Escape: 'escape',
  Space: 'space',
  Backspace: 'backspace',
  Home: 'home',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Minus: 'minus',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
});

/**
 * Returns the native key name of a keyboard event code, or null when native
 * menus cannot show that key.
 *
 * @param code Keyboard event code.
 * @returns Native key name, or null.
 */
export function nativeMenuAcceleratorKeyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  return NATIVE_MENU_ACCELERATOR_KEY_NAMES[code] ?? null;
}

/**
 * Converts a shortcut binding to a native key equivalent such as
 * "command+shift+s": the first of the configured binding and its platform
 * aliases that uses the primary modifier. Plain keys get none, so they keep
 * reaching text fields and map views.
 *
 * @param shortcut Shortcut binding, or undefined.
 * @param keyMap Platform key map adding the bindings of keys the keyboard
 *   lacks; defaults to the map of the platform this page runs on.
 * @returns Native key equivalent, or undefined when the row gets none.
 */
export function nativeMenuAcceleratorFromShortcut(
  shortcut: KeyboardShortcut | undefined,
  keyMap: PlatformKeyboardKeyMap = PLATFORM_KEYBOARD_KEY_MAP_CURRENT,
): string | undefined {
  if (!shortcut) {
    return undefined;
  }
  for (const binding of keyMap.shortcutBindings(shortcut)) {
    const accelerator = nativeMenuAcceleratorFromBinding(binding);
    if (accelerator !== undefined) {
      return accelerator;
    }
  }
  return undefined;
}

/**
 * Converts one binding to a native key equivalent when it uses the primary
 * modifier and a key native menus can show.
 *
 * @param binding Key and modifiers.
 * @returns Native key equivalent, or undefined.
 */
function nativeMenuAcceleratorFromBinding(binding: KeyboardShortcut): string | undefined {
  if (!binding.ctrl) {
    return undefined;
  }
  const keyName = nativeMenuAcceleratorKeyName(binding.code);
  if (keyName === null) {
    return undefined;
  }
  const modifierNames = [
    'command',
    binding.meta ? 'control' : '',
    binding.alt ? 'option' : '',
    binding.shift ? 'shift' : '',
  ].filter(Boolean);
  return [...modifierNames, keyName].join('+');
}
