import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputWheelBindingRange } from '@/ui/input/wheel/input_wheel_binding_range.js';
import { INPUT_WHEEL_STEP_SHIFT_MULTIPLIER } from '@/ui/input/wheel/input_wheel_step.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
  inputWheelTestRangeCreate,
} from './input_wheel_test_support.js';

/** Range limits and step every range binding test uses. */
const RANGE_BINDING_TEST_LIMITS = { minimum: 0, maximum: 50, step: 2 } as const;

/** Bindings built by the running test. */
const rangeBindingTestBindings: InputWheelBindingRange[] = [];

/**
 * Builds a mounted range with a wheel binding and change and input spies.
 *
 * @param value Starting value.
 * @param valueBlankRead Returns whether the range shows no value.
 * @returns Range, binding and spies.
 */
function rangeBindingTestCreate(
  value: number,
  valueBlankRead?: () => boolean,
): {
  range: HTMLInputElement;
  binding: InputWheelBindingRange;
  onChange: ReturnType<typeof vi.fn>;
  onInput: ReturnType<typeof vi.fn>;
} {
  const { minimum, maximum, step } = RANGE_BINDING_TEST_LIMITS;
  const range = inputWheelTestRangeCreate(minimum, maximum, step, value);
  const binding = new InputWheelBindingRange(range, range, valueBlankRead);
  const onChange = vi.fn();
  const onInput = vi.fn();
  range.addEventListener('change', onChange);
  range.addEventListener('input', onInput);
  rangeBindingTestBindings.push(binding);
  return { range, binding, onChange, onInput };
}

afterEach(() => {
  rangeBindingTestBindings.splice(0).forEach((binding) => binding.dispose());
  document.body.replaceChildren();
});

/** The wheel over a range steps its value like a user drag. */
describe('InputWheelBindingRange', () => {
  it('increases on scroll up, decreases on scroll down and fires input and change', () => {
    const start = RANGE_BINDING_TEST_LIMITS.step * 5;
    const { range, onChange, onInput } = rangeBindingTestCreate(start);
    const scrollUp = inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(Number(range.value)).toBe(start + RANGE_BINDING_TEST_LIMITS.step);
    expect(scrollUp.defaultPrevented).toBe(true);
    inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(Number(range.value)).toBe(start);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it('moves ten steps with Shift and one step with Ctrl', () => {
    const start = RANGE_BINDING_TEST_LIMITS.step;
    const { range } = rangeBindingTestCreate(start);
    inputWheelTestDispatch(range, { ...INPUT_WHEEL_TEST_NOTCH_UP, shiftKey: true });
    const shifted = start + RANGE_BINDING_TEST_LIMITS.step * INPUT_WHEEL_STEP_SHIFT_MULTIPLIER;
    expect(Number(range.value)).toBe(shifted);
    inputWheelTestDispatch(range, { ...INPUT_WHEEL_TEST_NOTCH_DOWN, ctrlKey: true });
    expect(Number(range.value)).toBe(shifted - RANGE_BINDING_TEST_LIMITS.step);
  });

  it('clamps at the range ends and lets the page scroll once at an end', () => {
    const { maximum, step } = RANGE_BINDING_TEST_LIMITS;
    const { range, onChange } = rangeBindingTestCreate(maximum - step);
    inputWheelTestDispatch(range, { ...INPUT_WHEEL_TEST_NOTCH_UP, shiftKey: true });
    expect(Number(range.value)).toBe(maximum);
    const pastEnd = inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(Number(range.value)).toBe(maximum);
    expect(pastEnd.defaultPrevented).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores the wheel while disabled, while blank and after dispose', () => {
    let isBlank = true;
    const start = RANGE_BINDING_TEST_LIMITS.step * 3;
    const { range, binding, onChange } = rangeBindingTestCreate(start, () => isBlank);
    const overBlank = inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(overBlank.defaultPrevented).toBe(false);
    isBlank = false;
    range.disabled = true;
    inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_UP);
    range.disabled = false;
    binding.dispose();
    inputWheelTestDispatch(range, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(Number(range.value)).toBe(start);
    expect(onChange).not.toHaveBeenCalled();
  });
});
