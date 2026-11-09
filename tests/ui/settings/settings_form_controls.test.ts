import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSettingsSelect, createSettingsSlider } from '@/ui/settings/settings_form_controls.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from '../input/wheel/input_wheel_test_support.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** Settings dialog selects and sliders step with the mouse wheel. */
describe('settings form controls', () => {
  it('steps a settings select with the wheel and reports the new value', () => {
    const options = ['low', 'medium', 'high'].map((value) => ({ value, label: value }));
    const onChange = vi.fn();
    const select = document.body.appendChild(createSettingsSelect(options, options[0]?.value ?? '', onChange));
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(onChange).toHaveBeenLastCalledWith(options[1]?.value);
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(onChange).toHaveBeenLastCalledWith(options[0]?.value);
  });

  it('steps a settings slider over its readout, updates the readout and stops at the maximum', () => {
    const minimum = 1;
    const maximum = 4;
    const onChange = vi.fn();
    const wrapper = createSettingsSlider(minimum, maximum, 1, maximum - 1, (value) => `${value} units`, onChange);
    document.body.appendChild(wrapper);
    const readout = wrapper.querySelector('span');
    if (!readout) throw new Error('readout missing');
    inputWheelTestDispatch(readout, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(onChange).toHaveBeenLastCalledWith(maximum);
    expect(readout.textContent).toBe(`${maximum} units`);
    const pastEnd = inputWheelTestDispatch(readout, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(pastEnd.defaultPrevented).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
