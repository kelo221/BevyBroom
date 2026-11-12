import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

/** Modifier flags of a browser keyboard or pointer event. */
export interface PlatformKeyboardModifierFlags {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** Input state that knows whether a Control key is held. */
export interface PlatformKeyboardControlKeyTracker {
  /**
   * Returns whether a Control key is held.
   *
   * @returns True while held.
   */
  isCtrlDown(): boolean;
}

/**
 * Maps the physical modifier keys of a platform onto the platform neutral
 * shortcut modifiers: the primary modifier (stored as ctrl) and the secondary
 * modifier (stored as meta).
 */
export abstract class PlatformKeyboardModifierMap {
  /**
   * Returns whether the primary shortcut modifier is held in an event.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  abstract primaryDown(flags: PlatformKeyboardModifierFlags): boolean;

  /**
   * Returns whether the secondary shortcut modifier is held in an event.
   *
   * @param flags Event modifier flags.
   * @returns True while held.
   */
  abstract secondaryDown(flags: PlatformKeyboardModifierFlags): boolean;

  /**
   * Returns whether tracked key state reports the primary modifier as held.
   *
   * @param tracker Input state tracking the Control keys.
   * @returns True while held.
   */
  abstract primaryTrackedDown(tracker: PlatformKeyboardControlKeyTracker): boolean;

  /**
   * Builds the user facing label of a shortcut.
   *
   * @param shortcut Shortcut binding.
   * @param keyLabel Label of the shortcut key.
   * @returns Shortcut label.
   */
  abstract labelFormat(shortcut: KeyboardShortcut, keyLabel: string): string;
}
