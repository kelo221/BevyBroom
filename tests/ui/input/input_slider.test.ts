import { describe, expect, it, vi } from 'vitest';
import { InputSlider, type InputSliderOptions } from '@/ui/input/input_slider.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from './wheel/input_wheel_test_support.js';

/** Options every slider test uses. */
const SLIDER_TEST_OPTIONS: InputSliderOptions = { ariaLabel: 'Test size', min: 1, max: 9, step: 0.5, decimals: 1 };

/**
 * Finds the range input of a slider.
 *
 * @param slider Slider.
 * @returns Range input.
 */
function sliderTestRangeFind(slider: InputSlider): HTMLInputElement {
  const range = slider
    .getElement()
    .querySelector<HTMLInputElement>(`input[aria-label="${SLIDER_TEST_OPTIONS.ariaLabel}"]`);
  if (!range) throw new Error('range missing');
  return range;
}

/**
 * Finds the number box of a slider.
 *
 * @param slider Slider.
 * @returns Number box.
 */
function sliderTestNumericFind(slider: InputSlider): HTMLInputElement {
  const label = `${SLIDER_TEST_OPTIONS.ariaLabel} value`;
  const numeric = slider.getElement().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!numeric) throw new Error('number box missing');
  return numeric;
}

/** The slider pairs a range with a number box, clamps and commits. */
describe('InputSlider', () => {
  it('shows a value on both the range and the number box, clamped to the range', () => {
    const slider = new InputSlider(SLIDER_TEST_OPTIONS);
    const middle = (SLIDER_TEST_OPTIONS.min + SLIDER_TEST_OPTIONS.max) / 2;
    slider.setNumber(middle);
    expect(Number(sliderTestRangeFind(slider).value)).toBe(middle);
    expect(slider.getValue()).toBe(middle);
    slider.setNumber(SLIDER_TEST_OPTIONS.max * 10);
    expect(slider.getValue()).toBe(SLIDER_TEST_OPTIONS.max);
    slider.setSharedValues([middle, SLIDER_TEST_OPTIONS.min]);
    expect(slider.getValue()).toBeNull();
    slider.dispose();
  });

  it('updates the box while dragging and commits once the range is released', () => {
    const slider = new InputSlider(SLIDER_TEST_OPTIONS);
    const commit = vi.fn();
    slider.bindCommit(commit);
    const range = sliderTestRangeFind(slider);
    range.value = String(SLIDER_TEST_OPTIONS.max - SLIDER_TEST_OPTIONS.step);
    range.dispatchEvent(new Event('input'));
    expect(slider.getValue()).toBe(SLIDER_TEST_OPTIONS.max - SLIDER_TEST_OPTIONS.step);
    expect(commit).not.toHaveBeenCalled();
    range.dispatchEvent(new Event('change'));
    expect(commit).toHaveBeenCalledTimes(1);
    slider.dispose();
  });

  it('clamps a typed value, moves the range to it and commits', () => {
    const slider = new InputSlider(SLIDER_TEST_OPTIONS);
    const commit = vi.fn(() => slider.getValue());
    slider.bindCommit(commit);
    const numeric = sliderTestNumericFind(slider);
    numeric.value = String(SLIDER_TEST_OPTIONS.min - 5);
    numeric.dispatchEvent(new Event('change'));
    expect(commit).toHaveReturnedWith(SLIDER_TEST_OPTIONS.min);
    expect(Number(sliderTestRangeFind(slider).value)).toBe(SLIDER_TEST_OPTIONS.min);
    slider.dispose();
    numeric.dispatchEvent(new Event('change'));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('steps up on wheel up over the number box, down on wheel down, and commits each step', () => {
    const slider = new InputSlider(SLIDER_TEST_OPTIONS);
    const commit = vi.fn(() => slider.getValue());
    slider.bindCommit(commit);
    const start = SLIDER_TEST_OPTIONS.min + SLIDER_TEST_OPTIONS.step * 2;
    slider.setNumber(start);
    const scrollUp = inputWheelTestDispatch(sliderTestNumericFind(slider), INPUT_WHEEL_TEST_NOTCH_UP);
    expect(commit).toHaveLastReturnedWith(start + SLIDER_TEST_OPTIONS.step);
    expect(scrollUp.defaultPrevented).toBe(true);
    inputWheelTestDispatch(sliderTestRangeFind(slider), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(commit).toHaveLastReturnedWith(start);
    expect(commit).toHaveBeenCalledTimes(2);
    slider.dispose();
  });

  it('clamps wheel steps at the ends and ignores the wheel over a mixed value', () => {
    const slider = new InputSlider(SLIDER_TEST_OPTIONS);
    const commit = vi.fn();
    slider.bindCommit(commit);
    slider.setNumber(SLIDER_TEST_OPTIONS.max);
    inputWheelTestDispatch(slider.getElement(), INPUT_WHEEL_TEST_NOTCH_UP);
    expect(slider.getValue()).toBe(SLIDER_TEST_OPTIONS.max);
    slider.setSharedValues([SLIDER_TEST_OPTIONS.min, SLIDER_TEST_OPTIONS.max]);
    const overMixed = inputWheelTestDispatch(slider.getElement(), INPUT_WHEEL_TEST_NOTCH_UP);
    expect(overMixed.defaultPrevented).toBe(false);
    expect(slider.getValue()).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    slider.dispose();
  });
});
