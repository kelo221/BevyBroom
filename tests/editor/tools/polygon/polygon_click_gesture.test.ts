import { describe, it, expect } from 'vitest';
import {
  PolygonClickGesture,
  POLYGON_CLICK_JITTER_TOLERANCE_PX,
} from '@/editor/tools/polygon/polygon_click_gesture.js';

describe('PolygonClickGesture', () => {
  it('returns the press point for a release within the jitter tolerance', () => {
    const gesture = new PolygonClickGesture();
    gesture.pressBegin(40, 60);
    expect(gesture.isPressed()).toBe(true);
    const jitter = POLYGON_CLICK_JITTER_TOLERANCE_PX / 2;
    expect(gesture.release(40 + jitter, 60 - jitter)).toEqual({ clientX: 40, clientY: 60 });
    expect(gesture.isPressed()).toBe(false);
  });

  it('returns null for a release beyond the tolerance or without a press', () => {
    const gesture = new PolygonClickGesture();
    gesture.pressBegin(0, 0);
    expect(gesture.release(POLYGON_CLICK_JITTER_TOLERANCE_PX + 1, 0)).toBeNull();
    expect(gesture.release(0, 0)).toBeNull();
  });

  it('forgets a press on reset', () => {
    const gesture = new PolygonClickGesture();
    gesture.pressBegin(5, 5);
    gesture.reset();
    expect(gesture.isPressed()).toBe(false);
    expect(gesture.release(5, 5)).toBeNull();
  });
});
