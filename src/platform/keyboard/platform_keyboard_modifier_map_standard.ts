import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import {
  PlatformKeyboardModifierMap,
  type PlatformKeyboardControlKeyTracker,
  type PlatformKeyboardModifierFlags,
  type PlatformKeyboardModifierName,
} from '@/platform/keyboard/platform_keyboard_modifier_map.js';

/** Modifier names shown on Windows and Linux. */
const PLATFORM_KEYBOARD_MODIFIER_LABELS_STANDARD: Readonly<Record<PlatformKeyboardModifierName, string>> =
  Object.freeze({ ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', meta: 'Meta' });

/**
 * Windows and Linux modifier map: Control is the primary modifier and the
 * Windows or Super key is the secondary modifier.
 */
export class PlatformKeyboardModifierMapStandard extends PlatformKeyboardModifierMap {
  /**
   * Returns whether Control is held.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  primaryDown(flags: PlatformKeyboardModifierFlags): boolean {
    return flags.ctrlKey;
  }

  /**
   * Returns whether the Windows or Super key is held.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  secondaryDown(flags: PlatformKeyboardModifierFlags): boolean {
    return flags.metaKey;
  }

  /**
   * Returns whether tracked key state reports Control as held.
   *
   * @param tracker Input state tracking the Control keys.
   * @returns True while held.
   */
  primaryTrackedDown(tracker: PlatformKeyboardControlKeyTracker): boolean {
    return tracker.isCtrlDown();
  }

  /**
   * Builds a label such as "Ctrl+Shift+E".
   *
   * @param shortcut Shortcut binding.
   * @param keyLabel Label of the shortcut key.
   * @returns Shortcut label.
   */
  labelFormat(shortcut: KeyboardShortcut, keyLabel: string): string {
    const modifierLabels = [
      shortcut.ctrl ? this.modifierLabel('ctrl') : '',
      shortcut.shift ? this.modifierLabel('shift') : '',
      shortcut.alt ? this.modifierLabel('alt') : '',
      shortcut.meta ? this.modifierLabel('meta') : '',
    ].filter(Boolean);
    return [...modifierLabels, keyLabel].join('+');
  }

  /**
   * Returns the modifier word, such as "Ctrl" or "Alt".
   *
   * @param modifier Platform neutral modifier.
   * @returns Modifier word.
   */
  modifierLabel(modifier: PlatformKeyboardModifierName): string {
    return PLATFORM_KEYBOARD_MODIFIER_LABELS_STANDARD[modifier];
  }

  /**
   * Returns "Ctrl": the physical Control key is the primary modifier.
   *
   * @returns Control key name.
   */
  controlKeyLabel(): string {
    return this.modifierLabel('ctrl');
  }
}
