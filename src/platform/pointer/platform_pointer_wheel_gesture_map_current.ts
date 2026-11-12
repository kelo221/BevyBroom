import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import type { PlatformPointerWheelGestureMap } from '@/platform/pointer/platform_pointer_wheel_gesture_map.js';
import { PlatformPointerWheelGestureMapMac } from '@/platform/pointer/platform_pointer_wheel_gesture_map_mac.js';
import { PlatformPointerWheelGestureMapStandard } from '@/platform/pointer/platform_pointer_wheel_gesture_map_standard.js';

/**
 * Creates the wheel gesture map of an operating system family.
 *
 * @param platformKind Operating system family.
 * @returns Wheel gesture map of that platform.
 */
export function platformPointerWheelGestureMapCreate(platformKind: PlatformKind): PlatformPointerWheelGestureMap {
  return platformKind === 'mac'
    ? new PlatformPointerWheelGestureMapMac()
    : new PlatformPointerWheelGestureMapStandard();
}

/** Wheel gesture map of the platform this page runs on. */
export const PLATFORM_POINTER_WHEEL_GESTURE_MAP_CURRENT: PlatformPointerWheelGestureMap =
  platformPointerWheelGestureMapCreate(platformKindRead());
