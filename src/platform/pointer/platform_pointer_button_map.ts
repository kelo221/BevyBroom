/** Button and modifier flags of a browser mouse or pointer press. */
export interface PlatformPointerPressFlags {
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** Mouse button index of the primary (left) button. */
export const PLATFORM_POINTER_BUTTON_PRIMARY = 0;

/** Mouse button index of the middle (wheel) button. */
export const PLATFORM_POINTER_BUTTON_MIDDLE = 1;

/** Mouse button index of the secondary (right) button. */
export const PLATFORM_POINTER_BUTTON_SECONDARY = 2;

/**
 * Maps the mouse gestures of a platform onto the mouse buttons the editor
 * reads, such as a modifier held with the primary button standing in for the
 * secondary button on one-button mice.
 */
export abstract class PlatformPointerButtonMap {
  /**
   * Returns whether a press on the primary button should act as a press of the
   * secondary button on this platform.
   *
   * @param flags Button and modifier flags of the press.
   * @returns True when the press stands in for the secondary button.
   */
  abstract secondaryButtonPressIs(flags: PlatformPointerPressFlags): boolean;
}
