import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import {
  PlatformKeyboardModifierMap,
  type PlatformKeyboardModifierFlags,
} from '@/platform/keyboard/platform_keyboard_modifier_map.js';

/**
 * MacOS modifier map: Command is the primary modifier and Control is the
 * secondary modifier, so a Ctrl+S binding is pressed as Command+S.
 */
export class PlatformKeyboardModifierMapMac extends PlatformKeyboardModifierMap {
  /**
   * Returns whether Command is held.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  primaryDown(flags: PlatformKeyboardModifierFlags): boolean {
    return flags.metaKey;
  }

  /**
   * Returns whether Control is held.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  secondaryDown(flags: PlatformKeyboardModifierFlags): boolean {
    return flags.ctrlKey;
  }

  /**
   * Returns false: macOS drops key releases while Command is held, so tracked
   * key state cannot be trusted for Command.
   *
   * @returns Always false.
   */
  primaryTrackedDown(): boolean {
    return false;
  }

  /**
   * Builds a macOS label such as "⇧⌘E" in the system modifier order.
   *
   * @param shortcut Shortcut binding.
   * @param keyLabel Label of the shortcut key.
   * @returns Shortcut label.
   */
  labelFormat(shortcut: KeyboardShortcut, keyLabel: string): string {
    const modifierSymbols = [
      shortcut.meta ? '⌃' : '',
      shortcut.alt ? '⌥' : '',
      shortcut.shift ? '⇧' : '',
      shortcut.ctrl ? '⌘' : '',
    ].join('');
    return `${modifierSymbols}${keyLabel}`;
  }
}
