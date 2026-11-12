import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import {
  PlatformKeyboardModifierMap,
  type PlatformKeyboardControlKeyTracker,
  type PlatformKeyboardModifierFlags,
} from '@/platform/keyboard/platform_keyboard_modifier_map.js';

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
      shortcut.ctrl ? 'Ctrl' : '',
      shortcut.shift ? 'Shift' : '',
      shortcut.alt ? 'Alt' : '',
      shortcut.meta ? 'Meta' : '',
    ].filter(Boolean);
    return [...modifierLabels, keyLabel].join('+');
  }
}
