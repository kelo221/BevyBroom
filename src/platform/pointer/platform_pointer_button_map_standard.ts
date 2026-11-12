import {
  PlatformPointerButtonMap,
  type PlatformPointerPressFlags,
} from '@/platform/pointer/platform_pointer_button_map.js';

/** Windows and Linux button map: every button is pressed as itself. */
export class PlatformPointerButtonMapStandard extends PlatformPointerButtonMap {
  /**
   * Returns false: the secondary button has its own button.
   *
   * @param _flags Button and modifier flags of the press.
   * @returns Always false.
   */
  secondaryButtonPressIs(_flags: PlatformPointerPressFlags): boolean {
    return false;
  }
}
