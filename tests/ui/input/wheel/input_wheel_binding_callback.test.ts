import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputWheelBindingCallback } from '@/ui/input/wheel/input_wheel_binding_callback.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from './input_wheel_test_support.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** The callback binding hands wheel steps to a custom control. */
describe('InputWheelBindingCallback', () => {
  it('passes each step to the callback and blocks the scroll only when consumed', () => {
    const element = document.body.appendChild(document.createElement('div'));
    const wheelStepApply = vi.fn((step: { direction: 1 | -1 }) => step.direction === 1);
    const binding = new InputWheelBindingCallback(element, { wheelIgnoredRead: () => false, wheelStepApply });
    const consumed = inputWheelTestDispatch(element, INPUT_WHEEL_TEST_NOTCH_UP);
    const refused = inputWheelTestDispatch(element, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(consumed.defaultPrevented).toBe(true);
    expect(refused.defaultPrevented).toBe(false);
    expect(wheelStepApply.mock.calls.map(([step]) => step.direction)).toEqual([1, -1]);
    binding.dispose();
  });

  it('does not step while ignored or after dispose', () => {
    const element = document.body.appendChild(document.createElement('div'));
    let isIgnored = true;
    const wheelStepApply = vi.fn(() => true);
    const binding = new InputWheelBindingCallback(element, { wheelIgnoredRead: () => isIgnored, wheelStepApply });
    inputWheelTestDispatch(element, INPUT_WHEEL_TEST_NOTCH_UP);
    isIgnored = false;
    binding.dispose();
    inputWheelTestDispatch(element, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(wheelStepApply).not.toHaveBeenCalled();
  });
});
