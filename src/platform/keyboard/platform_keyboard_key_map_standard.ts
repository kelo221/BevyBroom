import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';

/** Short labels of keyboard event codes that are not letters or digits. */
const PLATFORM_KEYBOARD_KEY_LABELS_STANDARD: Readonly<Record<string, string>> = Object.freeze({
  Delete: 'Del',
  Escape: 'Esc',
  Backquote: '`',
});

/**
 * Windows and Linux key map: every shortcut key exists on the keyboard, so no
 * binding has aliases, and keys are labelled with short words.
 */
export class PlatformKeyboardKeyMapStandard extends PlatformKeyboardKeyMap {
  /**
   * Builds a label such as "Del", "Esc" or "PageUp".
   *
   * @param code Keyboard event code.
   * @returns Key label.
   */
  keyLabel(code: string): string {
    if (code.startsWith('Key')) {
      return code.slice(3);
    }
    if (code.startsWith('Digit')) {
      return code.slice(5);
    }
    return PLATFORM_KEYBOARD_KEY_LABELS_STANDARD[code] ?? code;
  }

  /**
   * Builds a name such as "Delete", "Escape" or "PageUp": the code itself for
   * every key that is not a letter or digit.
   *
   * @param code Keyboard event code.
   * @returns Key name.
   */
  keyName(code: string): string {
    if (code.startsWith('Key')) {
      return code.slice(3);
    }
    if (code.startsWith('Digit')) {
      return code.slice(5);
    }
    return code;
  }

  /**
   * Returns no aliases: the configured key exists on the keyboard.
   *
   * @param _shortcut Configured shortcut binding.
   * @returns Empty list.
   */
  shortcutAliases(_shortcut: KeyboardShortcut): readonly KeyboardShortcut[] {
    return [];
  }
}
