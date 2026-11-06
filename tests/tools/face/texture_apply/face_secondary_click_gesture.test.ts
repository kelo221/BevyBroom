import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX,
  FaceSecondaryClickGesture,
} from '@/tools/face/texture_apply/face_secondary_click_gesture.js';

/** Client point every press starts at. */
const PRESS_POINT = { clientX: 120, clientY: 80 };

describe('FaceSecondaryClickGesture', () => {
  const gesture = new FaceSecondaryClickGesture();

  afterEach(() => {
    gesture.cancel();
  });

  it('fires once for a right release that stays under the drag threshold and reports Alt', () => {
    const handler = vi.fn();
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, handler);
    const smallMove = FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX / 2;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: PRESS_POINT.clientX + smallMove, clientY: 80 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2, altKey: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(handler.mock.calls).toEqual([[true]]);
    expect(gesture.isArmed()).toBe(false);
  });

  it('treats relative movement under pointer lock as a drag even when the client point stays put', () => {
    const handler = vi.fn();
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, handler);
    const lockedStep = FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX / 2;
    window.dispatchEvent(new PointerEvent('pointermove', { ...PRESS_POINT, movementX: lockedStep }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...PRESS_POINT, movementY: lockedStep }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...PRESS_POINT, movementX: lockedStep }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires the drag handler once when travel exceeds the click threshold and skips the click', () => {
    const clickHandler = vi.fn();
    const dragHandler = vi.fn();
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, clickHandler, dragHandler);
    const dragPx = FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX + 1;
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: PRESS_POINT.clientX + dragPx, clientY: 80, movementX: dragPx }),
    );
    expect(dragHandler).toHaveBeenCalledTimes(1);
    expect(gesture.isArmed()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it('does not fire for another button, a blur or a cancel', () => {
    const handler = vi.fn();
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, handler);
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 0 }));
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, handler);
    window.dispatchEvent(new Event('blur'));
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, handler);
    gesture.cancel();
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(handler).not.toHaveBeenCalled();
  });
});
