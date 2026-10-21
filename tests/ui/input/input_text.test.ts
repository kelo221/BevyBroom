import { describe, expect, it, vi } from 'vitest';
import { InputText } from '@/ui/input/input_text.js';

/** The text field shows shared text, marks mixed values and commits on change. */
describe('InputText', () => {
  it('shows shared text and a blank mixed field', () => {
    const input = new InputText('Name');
    input.setSharedValues(['gate', 'gate']);
    expect(input.getValue()).toBe('gate');
    input.setSharedValues(['gate', 'door']);
    expect(input.getValue()).toBe('');
    expect(input.getElement().placeholder).not.toBe('');
  });

  it('commits when the text changes', () => {
    const input = new InputText('Name');
    const commit = vi.fn();
    input.bindCommit(commit);
    input.getElement().value = 'hall';
    input.getElement().dispatchEvent(new Event('change'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(input.getElement().getAttribute('aria-label')).toBe('Name');
  });
});
