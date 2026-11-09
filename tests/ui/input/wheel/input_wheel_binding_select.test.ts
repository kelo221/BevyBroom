import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputWheelBindingSelect } from '@/ui/input/wheel/input_wheel_binding_select.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
  inputWheelTestSelectCreate,
} from './input_wheel_test_support.js';

/** Bindings built by the running test. */
const selectBindingTestBindings: InputWheelBindingSelect[] = [];

/**
 * Builds a mounted select with a wheel binding and change and input spies.
 *
 * @param values Option values in list order.
 * @returns Select, binding and spies.
 */
function selectBindingTestCreate(values: readonly string[]): {
  select: HTMLSelectElement;
  binding: InputWheelBindingSelect;
  onChange: ReturnType<typeof vi.fn>;
  onInput: ReturnType<typeof vi.fn>;
} {
  const select = inputWheelTestSelectCreate(values);
  const binding = new InputWheelBindingSelect(select);
  const onChange = vi.fn();
  const onInput = vi.fn();
  select.addEventListener('change', onChange);
  select.addEventListener('input', onInput);
  selectBindingTestBindings.push(binding);
  return { select, binding, onChange, onInput };
}

afterEach(() => {
  selectBindingTestBindings.splice(0).forEach((binding) => binding.dispose());
  document.body.replaceChildren();
});

/** The wheel over a select steps its option like a user choice. */
describe('InputWheelBindingSelect', () => {
  it('chooses the next option on scroll down, the previous on scroll up, and fires change', () => {
    const values = ['first', 'second', 'third'];
    const { select, onChange, onInput } = selectBindingTestCreate(values);
    select.value = values[0] ?? '';
    const scrollDown = inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.value).toBe(values[1]);
    expect(scrollDown.defaultPrevented).toBe(true);
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_UP);
    expect(select.value).toBe(values[0]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it('stays on the last option and lets the page scroll at the list end', () => {
    const values = ['first', 'last'];
    const { select, onChange } = selectBindingTestCreate(values);
    select.value = values[values.length - 1] ?? '';
    const pastEnd = inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.value).toBe(values[values.length - 1]);
    expect(pastEnd.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('skips disabled and hidden options', () => {
    const values = ['first', 'disabled', 'hidden', 'last'];
    const { select } = selectBindingTestCreate(values);
    const options = Array.from(select.options);
    const disabledOption = options[1];
    const hiddenOption = options[2];
    if (!disabledOption || !hiddenOption) throw new Error('options missing');
    disabledOption.disabled = true;
    hiddenOption.hidden = true;
    select.value = values[0] ?? '';
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.value).toBe(values[3]);
  });

  it('ignores the wheel while the select is disabled and after dispose', () => {
    const values = ['first', 'second'];
    const { select, binding, onChange } = selectBindingTestCreate(values);
    select.value = values[0] ?? '';
    select.disabled = true;
    const overDisabled = inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(overDisabled.defaultPrevented).toBe(false);
    select.disabled = false;
    binding.dispose();
    inputWheelTestDispatch(select, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.value).toBe(values[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps the select from the wheel over a surrounding element', () => {
    const values = ['first', 'second'];
    const select = inputWheelTestSelectCreate(values);
    const wrapper = document.createElement('div');
    const sibling = document.createElement('span');
    wrapper.append(select, sibling);
    document.body.appendChild(wrapper);
    selectBindingTestBindings.push(new InputWheelBindingSelect(select, wrapper));
    select.value = values[0] ?? '';
    inputWheelTestDispatch(sibling, INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.value).toBe(values[1]);
  });
});
