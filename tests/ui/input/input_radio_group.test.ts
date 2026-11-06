import { describe, expect, it, vi } from 'vitest';
import { InputRadioGroup } from '@/ui/input/input_radio_group.js';

/** Choices every radio group test uses. */
const RADIO_TEST_CHOICES = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
] as const;

/**
 * Finds the radio input of one entry by its label.
 *
 * @param group Radio group.
 * @param label Entry label.
 * @returns Radio input.
 */
function radioTestInputFind(group: InputRadioGroup<string>, label: string): HTMLInputElement {
  const radio = group.getElement().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!radio) throw new Error(`radio ${label} missing`);
  return radio;
}

/**
 * The radio group shows shared values, clears mixed ones and commits user
 * picks.
 */
describe('InputRadioGroup', () => {
  it('lists one labelled radio per choice inside a named radiogroup', () => {
    const group = new InputRadioGroup(RADIO_TEST_CHOICES, 'Test choice');
    expect(group.getElement().getAttribute('role')).toBe('radiogroup');
    expect(group.getElement().getAttribute('aria-label')).toBe('Test choice');
    const radios = [...group.getElement().querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((radio) => radio.value)).toEqual(RADIO_TEST_CHOICES.map((choice) => choice.value));
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
  });

  it('checks a shared value and clears every entry for mixed or empty values', () => {
    const group = new InputRadioGroup(RADIO_TEST_CHOICES, 'Test choice');
    group.setSharedValues(['second', 'second']);
    expect(group.getValue()).toBe('second');
    group.setSharedValues(['first', 'third']);
    expect(group.getValue()).toBeNull();
    group.setSharedValues([]);
    expect(group.getValue()).toBeNull();
  });

  it('commits when the user checks an entry and stops after dispose', () => {
    const group = new InputRadioGroup(RADIO_TEST_CHOICES, 'Test choice', 'row');
    const commit = vi.fn();
    group.bindCommit(commit);
    radioTestInputFind(group, 'Third').click();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(group.getValue()).toBe('third');
    group.dispose();
    radioTestInputFind(group, 'First').click();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('keeps separate groups independent', () => {
    const groupOne = new InputRadioGroup(RADIO_TEST_CHOICES, 'One');
    const groupTwo = new InputRadioGroup(RADIO_TEST_CHOICES, 'Two');
    document.body.append(groupOne.getElement(), groupTwo.getElement());
    radioTestInputFind(groupOne, 'First').click();
    radioTestInputFind(groupTwo, 'Second').click();
    expect(groupOne.getValue()).toBe('first');
    expect(groupTwo.getValue()).toBe('second');
    document.body.replaceChildren();
  });
});
