import {
  PlatformPointerWheelGestureMap,
  type PlatformPointerWheelFlags,
  type PlatformPointerWheelGesture,
} from '@/platform/pointer/platform_pointer_wheel_gesture_map.js';

/** Legacy wheel delta of one notch of a mouse wheel. */
const PLATFORM_POINTER_WHEEL_NOTCH_DELTA = 120;

/** Wheel delta mode of pixel deltas; lines and pages only come from mice. */
const PLATFORM_POINTER_WHEEL_DELTA_MODE_PIXEL = 0;

/**
 * MacOS wheel map: a pinch arrives as a wheel event with Control held, a mouse
 * wheel reports whole notches of 120 in the legacy wheel delta, and every other
 * wheel event is the two finger scroll of a trackpad.
 */
export class PlatformPointerWheelGestureMapMac extends PlatformPointerWheelGestureMap {
  /**
   * Classifies a wheel event as pinch, mouse wheel notch or trackpad scroll.
   *
   * @param flags Deltas and modifiers of the wheel event.
   * @returns Gesture the event performs.
   */
  gestureClassify(flags: PlatformPointerWheelFlags): PlatformPointerWheelGesture {
    if (this.pinchIs(flags)) {
      return 'zoom_pinch';
    }
    return PlatformPointerWheelGestureMapMac.mouseWheelIs(flags) ? 'zoom_step' : 'scroll_pan';
  }

  /**
   * Returns whether the wheel event carries a trackpad pinch, which browsers
   * report as a wheel event with Control held.
   *
   * @param flags Deltas and modifiers of the wheel event.
   * @returns True for a pinch.
   */
  override pinchIs(flags: PlatformPointerWheelFlags): boolean {
    return flags.ctrlKey;
  }

  /**
   * Returns whether the wheel event comes from a mouse wheel: line or page
   * deltas, or a vertical only turn whose legacy delta is whole notches.
   *
   * @param flags Deltas and modifiers of the wheel event.
   * @returns True for a mouse wheel notch.
   */
  private static mouseWheelIs(flags: PlatformPointerWheelFlags): boolean {
    if (flags.deltaMode !== PLATFORM_POINTER_WHEEL_DELTA_MODE_PIXEL) {
      return true;
    }
    if (flags.deltaX !== 0 || !Number.isInteger(flags.deltaY)) {
      return false;
    }
    const wheelDeltaY = flags.wheelDeltaY;
    if (wheelDeltaY === undefined) {
      return false;
    }
    return wheelDeltaY !== 0 && wheelDeltaY % PLATFORM_POINTER_WHEEL_NOTCH_DELTA === 0;
  }
}
