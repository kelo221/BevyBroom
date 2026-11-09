import { describe, expect, it } from 'vitest';
import { inputWheelListIndexStep } from '@/ui/input/wheel/input_wheel_list_index.js';
import type { InputWheelStep } from '@/ui/input/wheel/input_wheel_step.js';

/** Wheel step of one scroll-down notch. */
const LIST_INDEX_TEST_STEP_DOWN: InputWheelStep = { direction: -1, multiplier: 1 };

/** Wheel step of one scroll-up notch. */
const LIST_INDEX_TEST_STEP_UP: InputWheelStep = { direction: 1, multiplier: 1 };

/** Wheel notches move through list entries without wrapping. */
describe('inputWheelListIndexStep', () => {
  it('moves to the next entry on scroll down and the previous on scroll up', () => {
    const entryCount = 4;
    const middle = 1;
    expect(inputWheelListIndexStep(middle, entryCount, LIST_INDEX_TEST_STEP_DOWN, () => true)).toBe(middle + 1);
    expect(inputWheelListIndexStep(middle, entryCount, LIST_INDEX_TEST_STEP_UP, () => true)).toBe(middle - 1);
  });

  it('ignores the modifier multiplier and moves one entry', () => {
    const shiftedDown: InputWheelStep = { direction: -1, multiplier: 10 };
    expect(inputWheelListIndexStep(0, 20, shiftedDown, () => true)).toBe(1);
  });

  it('skips entries that cannot be chosen', () => {
    const blocked = new Set([1, 2]);
    expect(inputWheelListIndexStep(0, 4, LIST_INDEX_TEST_STEP_DOWN, (index) => !blocked.has(index))).toBe(3);
  });

  it('stops at both list ends instead of wrapping', () => {
    const entryCount = 3;
    expect(inputWheelListIndexStep(entryCount - 1, entryCount, LIST_INDEX_TEST_STEP_DOWN, () => true)).toBeNull();
    expect(inputWheelListIndexStep(0, entryCount, LIST_INDEX_TEST_STEP_UP, () => true)).toBeNull();
    expect(inputWheelListIndexStep(0, entryCount, LIST_INDEX_TEST_STEP_DOWN, (index) => index === 0)).toBeNull();
  });

  it('starts at the first entry when nothing is chosen', () => {
    expect(inputWheelListIndexStep(-1, 3, LIST_INDEX_TEST_STEP_DOWN, () => true)).toBe(0);
    expect(inputWheelListIndexStep(-1, 3, LIST_INDEX_TEST_STEP_UP, () => true)).toBeNull();
  });
});
