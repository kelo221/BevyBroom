import { describe, expect, it, vi } from 'vitest';
import { InputTextSuggest } from '@/ui/input/input_text_suggest.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/**
 * The suggest field links its input to its own suggestion list, replaces the
 * suggestions and still commits any typed text.
 */
describe('InputTextSuggest', () => {
  it('links each field to its own suggestion list and replaces the suggestions', () => {
    const first = new InputTextSuggest('First');
    const second = new InputTextSuggest('Second');
    const firstListId = first.inputElementRead().getAttribute('list');
    expect(firstListId).not.toBe(second.inputElementRead().getAttribute('list'));
    expect(first.getElement().querySelector(`datalist[id="${firstListId}"]`)).not.toBeNull();
    first.suggestionsWrite([
      { value: 'Open', label: 'Opens the door', title: 'Opens the door' },
      { value: 'Close', label: 'Close' },
    ]);
    first.suggestionsWrite([{ value: 'Enable', label: 'Enable' }]);
    expect(first.suggestionsRead()).toEqual(['Enable']);
  });

  it('shows a drop-down arrow that lists every suggestion and commits the picked one', () => {
    FloatingPanelStack.resetForTests();
    const field = new InputTextSuggest('Class');
    document.body.appendChild(field.getElement());
    const onCommit = vi.fn();
    field.bindCommit(onCommit);
    const suggestions = ['Point Light', 'Spot Light', 'Door'];
    field.suggestionsWrite(suggestions.map((value) => ({ value, label: value })));
    field.setSharedValues(['Door']);
    const arrow = field.arrowButtonRead();
    expect(field.getElement().contains(arrow)).toBe(true);
    arrow.click();
    const entries = [...document.querySelectorAll<HTMLButtonElement>('.editor-toolbar-dropdown-item')];
    expect(entries.map((entry) => entry.textContent?.trim())).toEqual(suggestions);
    entries.find((entry) => entry.textContent?.trim() === 'Spot Light')?.click();
    expect(field.getValue()).toBe('Spot Light');
    expect(onCommit).toHaveBeenCalledTimes(1);
    field.getElement().remove();
    FloatingPanelStack.resetForTests();
  });

  it('opens no list while the field is disabled', () => {
    FloatingPanelStack.resetForTests();
    const field = new InputTextSuggest('Class');
    field.suggestionsWrite([{ value: 'Door', label: 'Door' }]);
    field.inputElementRead().disabled = true;
    field.arrowButtonRead().click();
    expect(document.querySelectorAll('.editor-toolbar-dropdown-item')).toHaveLength(0);
    FloatingPanelStack.resetForTests();
  });

  it('commits typed text that is not a suggestion', () => {
    const field = new InputTextSuggest('Output');
    const onCommit = vi.fn();
    field.bindCommit(onCommit);
    field.suggestionsWrite([{ value: 'OnPressed', label: 'OnPressed' }]);
    field.inputElementRead().value = 'OnCustom';
    field.inputElementRead().dispatchEvent(new Event('change'));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(field.getValue()).toBe('OnCustom');
  });
});
