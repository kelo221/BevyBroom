import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InputSelectChoice } from '@/ui/input/input_select.js';
import { InputSelectAction } from '@/ui/input/input_select_action.js';
import { InputSelectBase } from '@/ui/input/input_select_base.js';
import { INPUT_WHEEL_TEST_NOTCH_DOWN, inputWheelTestDispatch } from './wheel/input_wheel_test_support.js';

/** Prompt entry followed by two actions. */
const SELECT_ACTION_TEST_CHOICES: readonly InputSelectChoice[] = [
  { value: '', label: 'Pick an action…' },
  { value: 'first_action', label: 'First action' },
  { value: 'second_action', label: 'Second action' },
];

/** Pickers built by the running test. */
const selectActionTestInstances: InputSelectAction[] = [];

/**
 * Builds a mounted action picker resting on its prompt, with a commit spy.
 *
 * @returns Picker and the spy called on every commit.
 */
function selectActionTestCreate(): { picker: InputSelectAction; onCommit: ReturnType<typeof vi.fn> } {
  const picker = new InputSelectAction(SELECT_ACTION_TEST_CHOICES, 'Test action');
  picker.setSharedValues(['']);
  const onCommit = vi.fn(() => picker.getValue());
  picker.bindCommit(onCommit);
  document.body.appendChild(picker.getElement());
  selectActionTestInstances.push(picker);
  return { picker, onCommit };
}

afterEach(() => {
  selectActionTestInstances.splice(0).forEach((picker) => picker.dispose());
  document.body.replaceChildren();
});

/** The action picker runs actions on user choices and ignores the wheel. */
describe('InputSelectAction', () => {
  it('shares the themed select base and commits a user choice', () => {
    const { picker, onCommit } = selectActionTestCreate();
    expect(picker).toBeInstanceOf(InputSelectBase);
    const chosenValue = SELECT_ACTION_TEST_CHOICES[2]?.value ?? '';
    picker.getElement().value = chosenValue;
    picker.getElement().dispatchEvent(new Event('change'));
    expect(onCommit).toHaveLastReturnedWith(chosenValue);
  });

  it('keeps its prompt and runs no action when the wheel scrolls over it', () => {
    const { picker, onCommit } = selectActionTestCreate();
    const overPicker = inputWheelTestDispatch(picker.getElement(), INPUT_WHEEL_TEST_NOTCH_DOWN);
    expect(overPicker.defaultPrevented).toBe(false);
    expect(picker.getValue()).toBe('');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
