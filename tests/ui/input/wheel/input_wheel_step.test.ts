import { describe, expect, it } from 'vitest';
import {
  INPUT_WHEEL_STEP_CTRL_MULTIPLIER,
  INPUT_WHEEL_STEP_SHIFT_MULTIPLIER,
  inputWheelStepResolve,
  inputWheelStepValueApply,
} from '@/ui/input/wheel/input_wheel_step.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestEventCreate,
} from './input_wheel_test_support.js';

/** One wheel notch resolves into a direction and a modifier multiplier. */
describe('inputWheelStepResolve', () => {
  it('reads scrolling up as direction 1 and scrolling down as direction -1', () => {
    expect(inputWheelStepResolve(inputWheelTestEventCreate(INPUT_WHEEL_TEST_NOTCH_UP))).toEqual({
      direction: 1,
      multiplier: 1,
    });
    expect(inputWheelStepResolve(inputWheelTestEventCreate(INPUT_WHEEL_TEST_NOTCH_DOWN))?.direction).toBe(-1);
  });

  it('uses the horizontal delta when there is no vertical movement', () => {
    expect(inputWheelStepResolve(inputWheelTestEventCreate({ deltaX: -40 }))?.direction).toBe(1);
    expect(inputWheelStepResolve(inputWheelTestEventCreate({ deltaX: 40 }))?.direction).toBe(-1);
  });

  it('scales by ten with Shift and by a tenth with Ctrl', () => {
    const shifted = inputWheelStepResolve(inputWheelTestEventCreate({ ...INPUT_WHEEL_TEST_NOTCH_UP, shiftKey: true }));
    const controlled = inputWheelStepResolve(
      inputWheelTestEventCreate({ ...INPUT_WHEEL_TEST_NOTCH_UP, ctrlKey: true }),
    );
    expect(shifted?.multiplier).toBe(INPUT_WHEEL_STEP_SHIFT_MULTIPLIER);
    expect(controlled?.multiplier).toBe(INPUT_WHEEL_STEP_CTRL_MULTIPLIER);
  });

  it('returns null when the wheel did not move', () => {
    expect(inputWheelStepResolve(inputWheelTestEventCreate({}))).toBeNull();
  });
});

/** A numeric step adds the scaled step size without floating point drift. */
describe('inputWheelStepValueApply', () => {
  it('adds and removes the scaled step', () => {
    const start = 3;
    const stepSize = 0.25;
    expect(inputWheelStepValueApply(start, stepSize, 1, 1)).toBe(start + stepSize);
    expect(inputWheelStepValueApply(start, stepSize, -1, 4)).toBe(start - stepSize * 4);
  });

  it('rounds repeated tenth steps back to exact decimals', () => {
    let value = 0;
    const repeatCount = 3;
    for (let index = 0; index < repeatCount; index += 1) {
      value = inputWheelStepValueApply(value, 1, 1, INPUT_WHEEL_STEP_CTRL_MULTIPLIER);
    }
    expect(value).toBe(0.3);
  });
});
