import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import {
  INPUT_WHEEL_TEST_NOTCH_DOWN,
  INPUT_WHEEL_TEST_NOTCH_UP,
  inputWheelTestDispatch,
} from './wheel/input_wheel_test_support.js';

/** Entries every select test offers. */
const SELECT_TEST_CHOICES: readonly InputSelectChoice[] = ['alpha', 'beta', 'gamma'].map((value) => ({
  value,
  label: value.toUpperCase(),
}));

/** Selects built by the running test. */
const selectTestInstances: InputSelect[] = [];

/**
 * Builds a mounted select with a commit spy.
 *
 * @returns Select and the spy called on every commit.
 */
function selectTestCreate(): { select: InputSelect; onCommit: ReturnType<typeof vi.fn> } {
  const select = new InputSelect(SELECT_TEST_CHOICES, 'Test choice');
  const onCommit = vi.fn(() => select.getValue());
  select.bindCommit(onCommit);
  document.body.appendChild(select.getElement());
  selectTestInstances.push(select);
  return { select, onCommit };
}

/**
 * Reads the stored value of a test choice.
 *
 * @param index Position of the choice.
 * @returns Stored value.
 */
function selectTestValueRead(index: number): string {
  return SELECT_TEST_CHOICES[index]?.value ?? '';
}

afterEach(() => {
  selectTestInstances.splice(0).forEach((select) => select.dispose());
  document.body.replaceChildren();
});

/** The themed select steps its entries with the mouse wheel and commits. */
describe('InputSelect', () => {
  it('commits the next entry on wheel down and the previous on wheel up', () => {
    const { select, onCommit } = selectTestCreate();
    select.setSharedValues([selectTestValueRead(0)]);
    inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(onCommit).toHaveLastReturnedWith(selectTestValueRead(1));
    inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_UP);
    expect(onCommit).toHaveLastReturnedWith(selectTestValueRead(0));
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('never lands on the hidden mixed entry and stops at the last entry', () => {
    const { select, onCommit } = selectTestCreate();
    select.setSharedValues([selectTestValueRead(0), selectTestValueRead(2)]);
    expect(select.getValue()).toBe('');
    inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.getValue()).toBe(selectTestValueRead(0));
    const lastIndex = SELECT_TEST_CHOICES.length - 1;
    select.setSharedValues([selectTestValueRead(lastIndex)]);
    const pastEnd = inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(pastEnd.defaultPrevented).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('leaves the value alone while the select is disabled and after dispose', () => {
    const { select, onCommit } = selectTestCreate();
    select.setSharedValues([selectTestValueRead(0)]);
    select.getElement().disabled = true;
    inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    select.getElement().disabled = false;
    select.dispose();
    inputWheelTestDispatch(select.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(select.getValue()).toBe(selectTestValueRead(0));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
