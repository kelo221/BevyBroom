import { describe, expect, it } from 'vitest';
import { POINTER_DRAG_THRESHOLD_PIXELS, pointerDragThresholdExceeded } from '@/input/pointer_drag_threshold.js';

/**
 * Proves the press-versus-drag decision: travel up to the threshold stays a
 * click, any travel beyond it in any direction becomes a drag.
 */
describe('pointerDragThresholdExceeded', () => {
  const pressX = 137;
  const pressY = 59;

  it('keeps travel within the threshold a click in every direction', () => {
    const directions = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [Math.SQRT1_2, Math.SQRT1_2],
    ];
    for (const [directionX, directionY] of directions) {
      const travel = POINTER_DRAG_THRESHOLD_PIXELS;
      expect(
        pointerDragThresholdExceeded(
          pressX,
          pressY,
          pressX + (directionX ?? 0) * travel,
          pressY + (directionY ?? 0) * travel,
        ),
      ).toBe(false);
    }
  });

  it('turns travel just beyond the threshold into a drag', () => {
    const travel = POINTER_DRAG_THRESHOLD_PIXELS + 0.5;
    expect(pointerDragThresholdExceeded(pressX, pressY, pressX + travel, pressY)).toBe(true);
    expect(pointerDragThresholdExceeded(pressX, pressY, pressX, pressY - travel)).toBe(true);
  });

  it('measures diagonal travel by its length, not per axis', () => {
    const perAxisTravel = POINTER_DRAG_THRESHOLD_PIXELS * 0.8;
    expect(perAxisTravel).toBeLessThan(POINTER_DRAG_THRESHOLD_PIXELS);
    expect(pointerDragThresholdExceeded(pressX, pressY, pressX + perAxisTravel, pressY + perAxisTravel)).toBe(true);
  });
});
