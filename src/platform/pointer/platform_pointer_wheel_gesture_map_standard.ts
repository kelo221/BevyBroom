import {
  PlatformPointerWheelGestureMap,
  type PlatformPointerWheelFlags,
  type PlatformPointerWheelGesture,
} from '@/platform/pointer/platform_pointer_wheel_gesture_map.js';

/** Windows and Linux wheel map: every wheel event is a zoom notch. */
export class PlatformPointerWheelGestureMapStandard extends PlatformPointerWheelGestureMap {
  /**
   * Returns a zoom notch for every wheel event.
   *
   * @param _flags Deltas and modifiers of the wheel event.
   * @returns Always a zoom notch.
   */
  gestureClassify(_flags: PlatformPointerWheelFlags): PlatformPointerWheelGesture {
    return 'zoom_step';
  }
}
