import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import type { PlatformPointerButtonMap } from '@/platform/pointer/platform_pointer_button_map.js';
import { PlatformPointerButtonMapMac } from '@/platform/pointer/platform_pointer_button_map_mac.js';
import { PlatformPointerButtonMapStandard } from '@/platform/pointer/platform_pointer_button_map_standard.js';

/**
 * Creates the pointer button map of an operating system family.
 *
 * @param platformKind Operating system family.
 * @returns Button map of that platform.
 */
export function platformPointerButtonMapCreate(platformKind: PlatformKind): PlatformPointerButtonMap {
  return platformKind === 'mac' ? new PlatformPointerButtonMapMac() : new PlatformPointerButtonMapStandard();
}

/** Pointer button map of the platform this page runs on. */
export const PLATFORM_POINTER_BUTTON_MAP_CURRENT: PlatformPointerButtonMap =
  platformPointerButtonMapCreate(platformKindRead());
