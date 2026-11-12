import { describe, expect, it } from 'vitest';
import { platformPointerWheelGestureMapCreate } from '@/platform/pointer/platform_pointer_wheel_gesture_map_current.js';
import type { PlatformPointerWheelFlags } from '@/platform/pointer/platform_pointer_wheel_gesture_map.js';

/**
 * Builds wheel flags with pixel deltas and no modifiers.
 *
 * @param overrides Fields that differ from a plain vertical pixel scroll.
 * @returns Wheel flags.
 */
function wheelFlags(overrides: Partial<PlatformPointerWheelFlags>): PlatformPointerWheelFlags {
  return { deltaX: 0, deltaY: 12, deltaMode: 0, ctrlKey: false, ...overrides };
}

/** Mouse wheel notch as WebKit and Chromium report it on macOS. */
const MOUSE_NOTCH = wheelFlags({ deltaY: 4, wheelDeltaY: -120 });

/**
 * Trackpad two finger scroll: small deltas on both axes, legacy delta of three
 * per pixel.
 */
const TRACKPAD_SCROLL = wheelFlags({ deltaX: -3, deltaY: 7, wheelDeltaY: -21 });

/** Trackpad pinch as browsers report it: a wheel event with Control held. */
const TRACKPAD_PINCH = wheelFlags({ deltaY: -6, ctrlKey: true, wheelDeltaY: 18 });

describe('platform pointer wheel gesture maps', () => {
  it('classifies every wheel event as a zoom notch on Windows and Linux, pinch included', () => {
    for (const platform of ['windows', 'linux', 'other'] as const) {
      const map = platformPointerWheelGestureMapCreate(platform);
      expect(map.gestureClassify(MOUSE_NOTCH)).toBe('zoom_step');
      expect(map.gestureClassify(TRACKPAD_SCROLL)).toBe('zoom_step');
      expect(map.gestureClassify(TRACKPAD_PINCH)).toBe('zoom_step');
      expect(map.gestureResolve(TRACKPAD_PINCH, 'auto')).toBe('zoom_step');
      expect(map.pinchIs(TRACKPAD_PINCH)).toBe(false);
    }
  });

  it('tells mouse notches, trackpad scrolls and pinches apart on macOS', () => {
    const map = platformPointerWheelGestureMapCreate('mac');
    expect(map.gestureClassify(MOUSE_NOTCH)).toBe('zoom_step');
    expect(map.gestureClassify(wheelFlags({ deltaY: 3, deltaMode: 1 }))).toBe('zoom_step');
    expect(map.gestureClassify(TRACKPAD_SCROLL)).toBe('scroll_pan');
    expect(map.gestureClassify(wheelFlags({ deltaY: 2.5, wheelDeltaY: -7.5 }))).toBe('scroll_pan');
    expect(map.gestureClassify(wheelFlags({ deltaY: 40 }))).toBe('scroll_pan');
    expect(map.gestureClassify(TRACKPAD_PINCH)).toBe('zoom_pinch');
    expect(map.pinchIs(TRACKPAD_PINCH)).toBe(true);
  });

  it('lets the user force zoom or pan for the plain wheel while a pinch still zooms on macOS', () => {
    const map = platformPointerWheelGestureMapCreate('mac');
    expect(map.gestureResolve(TRACKPAD_SCROLL, 'zoom')).toBe('zoom_step');
    expect(map.gestureResolve(MOUSE_NOTCH, 'pan')).toBe('scroll_pan');
    expect(map.gestureResolve(TRACKPAD_PINCH, 'zoom')).toBe('zoom_pinch');
    expect(map.gestureResolve(TRACKPAD_PINCH, 'pan')).toBe('zoom_pinch');
    expect(map.gestureResolve(TRACKPAD_SCROLL, 'auto')).toBe('scroll_pan');
  });

  it('keeps the forced preference on Windows and Linux without turning Control+wheel into a pinch', () => {
    const map = platformPointerWheelGestureMapCreate('windows');
    expect(map.gestureResolve(MOUSE_NOTCH, 'pan')).toBe('scroll_pan');
    expect(map.gestureResolve(TRACKPAD_PINCH, 'pan')).toBe('scroll_pan');
    expect(map.gestureResolve(TRACKPAD_SCROLL, 'zoom')).toBe('zoom_step');
  });
});
