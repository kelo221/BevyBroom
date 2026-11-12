import type { MouseSettings } from '@/settings/store/settings_types.js';
import { PLATFORM_POINTER_BUTTON_MAP_CURRENT } from '@/platform/pointer/platform_pointer_button_map_current.js';
import { PlatformPointerButtonRemap } from '@/platform/pointer/platform_pointer_button_remap.js';
import {
  PlatformPointerButtonRemapRuleMiddleEmulation,
  PlatformPointerButtonRemapRuleSecondaryClick,
} from '@/platform/pointer/platform_pointer_button_remap_rule.js';

/**
 * Creates the pointer button remap of the editor windows: the platform's
 * secondary click (Control+click on macOS) acts as the right button, and Alt
 * with the left button acts as the middle button while the mouse setting is
 * on.
 *
 * @param mouseSettingsRead Reads the current mouse settings, or null before the
 *   settings store exists.
 * @returns Remap ready to install on windows.
 */
export function createLayoutPlatformPointerRemap(
  mouseSettingsRead: () => MouseSettings | null,
): PlatformPointerButtonRemap {
  return new PlatformPointerButtonRemap([
    new PlatformPointerButtonRemapRuleSecondaryClick(PLATFORM_POINTER_BUTTON_MAP_CURRENT),
    new PlatformPointerButtonRemapRuleMiddleEmulation(
      () => mouseSettingsRead()?.altLeftDragEmulatesMiddleMouse === true,
    ),
  ]);
}
