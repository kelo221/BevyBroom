import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX,
  FaceSecondaryClickGesture,
} from '@/tools/face/texture_apply/face_secondary_click_gesture.js';

/** Client point every press starts at. */
const PRESS_POINT = { clientX: 120, clientY: 80 };

/**
 * Dispatches a cancelable context menu event on the window.
 *
 * @returns True when a listener prevented the browser menu.
 */
function contextMenuDispatchIsPrevented(): boolean {
  const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  window.dispatchEvent(contextMenu);
  return contextMenu.defaultPrevented;
}

/**
 * Waits until the tasks queued with a zero timeout have run.
 *
 * @returns Promise resolved on the next task.
 */
function nextTaskWait(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/** Moves the pointer just past the drag threshold from the press point. */
function gestureDragPastThreshold(): void {
  const dragPx = FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX + 1;
  window.dispatchEvent(
    new PointerEvent('pointermove', { clientX: PRESS_POINT.clientX + dragPx, clientY: PRESS_POINT.clientY }),
  );
}

describe('FaceSecondaryClickGesture', () => {
  const gesture = new FaceSecondaryClickGesture();

  afterEach(async () => {
    gesture.cancel();
    await nextTaskWait();
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
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: PRESS_POINT.clientX + dragPx * 2, clientY: 80, movementX: dragPx }),
    );
    expect(dragHandler).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it('keeps blocking the context menu after a drag hand-off until the tick after the release', async () => {
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, vi.fn(), vi.fn());
    gestureDragPastThreshold();
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(false);
  });

  it('clears the context menu suppression when a blur ends a handed-off press', async () => {
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, vi.fn(), vi.fn());
    gestureDragPastThreshold();
    window.dispatchEvent(new Event('blur'));
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(false);
  });

  it('keeps blocking the context menu when a new press arms before the previous deferred removal', async () => {
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, vi.fn());
    window.dispatchEvent(new PointerEvent('pointerup', { ...PRESS_POINT, button: 2 }));
    gesture.begin(window, PRESS_POINT.clientX, PRESS_POINT.clientY, vi.fn());
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(true);
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
