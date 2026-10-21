import { describe, expect, it, vi } from 'vitest';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';

/** The checkbox shows shared states, marks mixed ones and commits on toggle. */
describe('InputCheckbox', () => {
  it('shows a shared state and an indeterminate mixed state', () => {
    const input = new InputCheckbox('Locked');
    input.setSharedValues([true, true]);
    expect(input.getValue()).toBe(true);
    expect(input.getElement().indeterminate).toBe(false);
    input.setSharedValues([true, false]);
    expect(input.getElement().indeterminate).toBe(true);
  });

  it('commits when toggled', () => {
    const input = new InputCheckbox('Locked');
    const commit = vi.fn();
    input.bindCommit(commit);
    input.getElement().click();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(input.getValue()).toBe(true);
  });
});
