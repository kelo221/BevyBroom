import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

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
 * "command+shift+s". Only shortcuts that use the primary modifier become key
 * equivalents, so plain keys keep reaching text fields and map views.
 *
 * @param shortcut Shortcut binding, or undefined.
 * @returns Native key equivalent, or undefined when the row gets none.
 */
export function nativeMenuAcceleratorFromShortcut(shortcut: KeyboardShortcut | undefined): string | undefined {
  if (!shortcut || !shortcut.ctrl) {
    return undefined;
  }
  const keyName = nativeMenuAcceleratorKeyName(shortcut.code);
  if (keyName === null) {
    return undefined;
  }
  const modifierNames = [
    'command',
    shortcut.meta ? 'control' : '',
    shortcut.alt ? 'option' : '',
    shortcut.shift ? 'shift' : '',
  ].filter(Boolean);
  return [...modifierNames, keyName].join('+');
}
