import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';

/**
 * Key glyphs macOS menus show for keyboard event codes that are not letters or
 * digits.
 */
const PLATFORM_KEYBOARD_KEY_LABELS_MAC: Readonly<Record<string, string>> = Object.freeze({
  Backspace: '⌫',
  Delete: '⌦',
  Escape: '⎋',
  Tab: '⇥',
  Enter: '↩',
  NumpadEnter: '⌤',
  Space: 'Space',
  Home: '↖',
  End: '↘',
  PageUp: '⇞',
  PageDown: '⇟',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '`',
});

/**
 * Keyboard event code of the forward delete key that Mac keyboards only reach
 * through Fn+Delete.
 */
export const PLATFORM_KEYBOARD_KEY_MAP_MAC_FORWARD_DELETE_CODE = 'Delete';

/** Keyboard event code the Mac delete key sends. */
export const PLATFORM_KEYBOARD_KEY_MAP_MAC_DELETE_CODE = 'Backspace';

/**
 * Arrow key codes that stand in for the page keys Mac keyboards lack, pressed
 * with Option.
 */
const PLATFORM_KEYBOARD_KEY_MAP_MAC_PAGE_KEY_ARROWS: Readonly<Record<string, string>> = Object.freeze({
  PageUp: 'ArrowUp',
  PageDown: 'ArrowDown',
});

/**
 * MacOS key map: the delete key sends Backspace, so a shortcut on the forward
 * delete key also fires on Backspace and on Command+Backspace; Option+Up and
 * Option+Down stand in for Page Up and Page Down; keys are labelled with the
 * glyphs of the system menus.
 */
export class PlatformKeyboardKeyMapMac extends PlatformKeyboardKeyMap {
  /**
   * Builds a label such as "⌫", "⌦" or "⎋".
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
    return PLATFORM_KEYBOARD_KEY_LABELS_MAC[code] ?? code;
  }

  /**
   * Builds the same glyph as the label, since macOS writes keys as glyphs in
   * sentences too.
   *
   * @param code Keyboard event code.
   * @returns Key name.
   */
  keyName(code: string): string {
    return this.keyLabel(code);
  }

  /**
   * Returns the Mac bindings of a shortcut on a key Mac keyboards lack: the
   * delete key with and without Command for forward delete, Option+arrow for
   * the page keys. Bindings equal to the configured one are left out.
   *
   * @param shortcut Configured shortcut binding.
   * @returns Alternative bindings; empty when the configured key exists.
   */
  shortcutAliases(shortcut: KeyboardShortcut): readonly KeyboardShortcut[] {
    const candidates = PlatformKeyboardKeyMapMac.aliasCandidates(shortcut);
    return candidates.filter(
      (candidate, index) =>
        !platformKeyboardShortcutEquals(candidate, shortcut) &&
        candidates.findIndex((other) => platformKeyboardShortcutEquals(other, candidate)) === index,
    );
  }

  /**
   * Builds the raw alias candidates of a shortcut before duplicates are
   * removed.
   *
   * @param shortcut Configured shortcut binding.
   * @returns Candidate bindings.
   */
  private static aliasCandidates(shortcut: KeyboardShortcut): KeyboardShortcut[] {
    if (shortcut.code === PLATFORM_KEYBOARD_KEY_MAP_MAC_FORWARD_DELETE_CODE) {
      return [
        { ...shortcut, code: PLATFORM_KEYBOARD_KEY_MAP_MAC_DELETE_CODE },
        { ...shortcut, code: PLATFORM_KEYBOARD_KEY_MAP_MAC_DELETE_CODE, ctrl: true },
      ];
    }
    const pageKeyArrow = PLATFORM_KEYBOARD_KEY_MAP_MAC_PAGE_KEY_ARROWS[shortcut.code];
    if (pageKeyArrow !== undefined) {
      return [{ ...shortcut, code: pageKeyArrow, alt: true }];
    }
    return [];
  }
}

/**
 * Returns whether two shortcut bindings have the same key and modifiers.
 *
 * @param first First binding.
 * @param second Second binding.
 * @returns True when both bindings are the same key press.
 */
export function platformKeyboardShortcutEquals(first: KeyboardShortcut, second: KeyboardShortcut): boolean {
  return (
    first.code === second.code &&
    first.ctrl === second.ctrl &&
    first.shift === second.shift &&
    first.alt === second.alt &&
    first.meta === second.meta
  );
}
