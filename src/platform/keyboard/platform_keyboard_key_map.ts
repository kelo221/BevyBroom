import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

/**
 * Maps the keys of a platform keyboard onto the platform neutral shortcut
 * codes: which codes stand in for keys the keyboard lacks, and how each key is
 * labelled in menus and tooltips.
 */
export abstract class PlatformKeyboardKeyMap {
  /**
   * Builds the user facing label of a keyboard event code, such as "Del" or
   * "⌦".
   *
   * @param code Keyboard event code.
   * @returns Key label.
   */
  abstract keyLabel(code: string): string;

  /**
   * Builds the name of a keyboard event code as written inside a sentence, such
   * as "Delete" or "⌦".
   *
   * @param code Keyboard event code.
   * @returns Key name.
   */
  abstract keyName(code: string): string;

  /**
   * Returns the bindings that also trigger a shortcut on this platform because
   * its keyboards lack the configured key, in the order they are offered.
   *
   * @param shortcut Configured shortcut binding.
   * @returns Alternative bindings; empty when the configured key exists.
   */
  abstract shortcutAliases(shortcut: KeyboardShortcut): readonly KeyboardShortcut[];

  /**
   * Returns the configured binding followed by its platform aliases.
   *
   * @param shortcut Configured shortcut binding.
   * @returns Every binding that triggers the shortcut.
   */
  shortcutBindings(shortcut: KeyboardShortcut): readonly KeyboardShortcut[] {
    return [shortcut, ...this.shortcutAliases(shortcut)];
  }
}
