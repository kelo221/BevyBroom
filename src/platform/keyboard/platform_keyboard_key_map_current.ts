import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import type { PlatformKeyboardKeyMap } from '@/platform/keyboard/platform_keyboard_key_map.js';
import { PlatformKeyboardKeyMapMac } from '@/platform/keyboard/platform_keyboard_key_map_mac.js';
import { PlatformKeyboardKeyMapStandard } from '@/platform/keyboard/platform_keyboard_key_map_standard.js';

/**
 * Creates the key map of an operating system family.
 *
 * @param platformKind Operating system family.
 * @returns Key map of that platform.
 */
export function platformKeyboardKeyMapCreate(platformKind: PlatformKind): PlatformKeyboardKeyMap {
  return platformKind === 'mac' ? new PlatformKeyboardKeyMapMac() : new PlatformKeyboardKeyMapStandard();
}

/** Key map of the platform this page runs on. */
export const PLATFORM_KEYBOARD_KEY_MAP_CURRENT: PlatformKeyboardKeyMap =
  platformKeyboardKeyMapCreate(platformKindRead());
