import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import {
  PlatformKeyboardModifierMap,
  type PlatformKeyboardModifierFlags,
  type PlatformKeyboardModifierName,
} from '@/platform/keyboard/platform_keyboard_modifier_map.js';

/** Modifier symbols of the macOS menus: Command, Shift, Option and Control. */
const PLATFORM_KEYBOARD_MODIFIER_LABELS_MAC: Readonly<Record<PlatformKeyboardModifierName, string>> = Object.freeze({
  ctrl: '⌘',
  shift: '⇧',
  alt: '⌥',
  meta: '⌃',
});

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
      shortcut.meta ? this.modifierLabel('meta') : '',
      shortcut.alt ? this.modifierLabel('alt') : '',
      shortcut.shift ? this.modifierLabel('shift') : '',
      shortcut.ctrl ? this.modifierLabel('ctrl') : '',
    ].join('');
    return `${modifierSymbols}${keyLabel}`;
  }

  /**
   * Returns the modifier symbol, such as "⌘" for the primary modifier or "⌃"
   * for the secondary one.
   *
   * @param modifier Platform neutral modifier.
   * @returns Modifier symbol.
   */
  modifierLabel(modifier: PlatformKeyboardModifierName): string {
    return PLATFORM_KEYBOARD_MODIFIER_LABELS_MAC[modifier];
  }

  /**
   * Returns "⌃": the physical Control key is the secondary modifier.
   *
   * @returns Control key name.
   */
  controlKeyLabel(): string {
    return this.modifierLabel('meta');
  }
}
