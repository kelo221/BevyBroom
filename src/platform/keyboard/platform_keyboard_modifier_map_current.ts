import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import type { PlatformKeyboardModifierMap } from '@/platform/keyboard/platform_keyboard_modifier_map.js';
import { PlatformKeyboardModifierMapMac } from '@/platform/keyboard/platform_keyboard_modifier_map_mac.js';
import { PlatformKeyboardModifierMapStandard } from '@/platform/keyboard/platform_keyboard_modifier_map_standard.js';

/**
 * Creates the modifier map of an operating system family.
 *
 * @param platformKind Operating system family.
 * @returns Modifier map of that platform.
 */
export function platformKeyboardModifierMapCreate(platformKind: PlatformKind): PlatformKeyboardModifierMap {
  return platformKind === 'mac' ? new PlatformKeyboardModifierMapMac() : new PlatformKeyboardModifierMapStandard();
}

/** Modifier map of the platform this page runs on. */
export const PLATFORM_KEYBOARD_MODIFIER_MAP_CURRENT: PlatformKeyboardModifierMap =
  platformKeyboardModifierMapCreate(platformKindRead());
