/** What a wheel event over a 2D view means. */
export type PlatformPointerWheelGesture = 'zoom_step' | 'zoom_pinch' | 'scroll_pan';

/** User preference for the wheel over 2D views. */
export type PlatformPointerWheelPreference = 'auto' | 'zoom' | 'pan';

/** Every wheel preference in menu order. */
export const PLATFORM_POINTER_WHEEL_PREFERENCES: readonly PlatformPointerWheelPreference[] = Object.freeze([
  'auto',
  'zoom',
  'pan',
]);

/** Fields of a wheel event the gesture maps read. */
export interface PlatformPointerWheelFlags {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  /** Legacy wheel delta in notches of 120, reported by WebKit and Chromium. */
  readonly wheelDeltaY?: number;
}

/**
 * Tells wheel turns of a mouse apart from the scroll and pinch gestures of a
 * trackpad on a platform, so 2D views can zoom on one and pan on the other.
 */
export abstract class PlatformPointerWheelGestureMap {
  /**
   * Classifies a wheel event when the user left the choice to the platform.
   *
   * @param flags Deltas and modifiers of the wheel event.
   * @returns Gesture the event performs.
   */
  abstract gestureClassify(flags: PlatformPointerWheelFlags): PlatformPointerWheelGesture;

  /**
   * Resolves the gesture of a wheel event under a user preference: "auto" asks
   * the platform, "zoom" and "pan" force the plain wheel while a pinch still
   * zooms on platforms that know one.
   *
   * @param flags Deltas and modifiers of the wheel event.
   * @param preference User preference for the plain wheel.
   * @returns Gesture the event performs.
   */
  gestureResolve(
    flags: PlatformPointerWheelFlags,
    preference: PlatformPointerWheelPreference,
  ): PlatformPointerWheelGesture {
    if (preference === 'auto') {
      return this.gestureClassify(flags);
    }
    if (this.pinchIs(flags)) {
      return 'zoom_pinch';
    }
    return preference === 'pan' ? 'scroll_pan' : 'zoom_step';
  }

  /**
   * Returns whether the platform reports a trackpad pinch through this wheel
   * event.
   *
   * @param _flags Deltas and modifiers of the wheel event.
   * @returns True for a pinch.
   */
  pinchIs(_flags: PlatformPointerWheelFlags): boolean {
    return false;
  }
}
