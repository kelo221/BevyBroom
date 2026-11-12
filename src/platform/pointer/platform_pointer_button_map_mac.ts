import {
  PLATFORM_POINTER_BUTTON_PRIMARY,
  PlatformPointerButtonMap,
  type PlatformPointerPressFlags,
} from '@/platform/pointer/platform_pointer_button_map.js';

/**
 * MacOS button map: Control held with the primary button is the system
 * secondary click, so it acts as the secondary button.
 */
export class PlatformPointerButtonMapMac extends PlatformPointerButtonMap {
  /**
   * Returns whether the press is a Control+click.
   *
   * @param flags Button and modifier flags of the press.
   * @returns True for the primary button with Control held.
   */
  secondaryButtonPressIs(flags: PlatformPointerPressFlags): boolean {
    return flags.button === PLATFORM_POINTER_BUTTON_PRIMARY && flags.ctrlKey;
  }
}
