import { afterEach, describe, expect, it } from 'vitest';
import {
  DIALOG_PROMPT_FIELD_ATTRIBUTE,
  showPromptFields,
  type DialogPromptField,
} from '@/ui/dialog/dialog_prompt_fields.js';

/**
 * Builds a prompt field.
 *
 * @param id Field id.
 * @param value Starting text.
 * @param isRequired Whether the field must hold text.
 * @param suggestions Offered values.
 * @returns Field.
 */
function fieldCreate(id: string, value: string, isRequired: boolean, suggestions: string[] = []): DialogPromptField {
  return { id, label: id, value, placeholder: '', isRequired, suggestions };
}

/**
 * Returns the input of a prompt field.
 *
 * @param fieldId Field id.
 * @returns Input element.
 */
function inputRead(fieldId: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`[${DIALOG_PROMPT_FIELD_ATTRIBUTE}="${fieldId}"]`);
  if (input === null) throw new Error(`field ${fieldId} is not shown`);
  return input;
}

/**
 * Presses a key on the focused element.
 *
 * @param key Key name.
 */
function keyPress(key: string): void {
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
});

/** Small modal prompts with text fields. */
describe('showPromptFields', () => {
  it('answers the trimmed text of every field on Enter and focuses the first field', async () => {
    const answer = showPromptFields({
      host: document.body,
      title: 'Make Prefab',
      confirmLabel: 'Make',
      fields: [fieldCreate('name', '', true), fieldCreate('category', 'Props', false, ['Props', 'Doors'])],
    });
    expect(document.activeElement).toBe(inputRead('name'));
    inputRead('name').value = '  Vault Door ';
    keyPress('Enter');
    await expect(answer).resolves.toEqual({ name: 'Vault Door', category: 'Props' });
  });

  it('ignores Enter while a required field is blank and answers null on Escape', async () => {
    const answer = showPromptFields({
      host: document.body,
      title: 'Rename Prefab',
      confirmLabel: 'Rename',
      fields: [fieldCreate('name', '   ', true)],
    });
    keyPress('Enter');
    expect(inputRead('name').isConnected).toBe(true);
    keyPress('Escape');
    await expect(answer).resolves.toBeNull();
  });

  it('offers a field suggestions as a list', () => {
    void showPromptFields({
      host: document.body,
      title: 'Change Category',
      confirmLabel: 'Move',
      fields: [fieldCreate('category', 'Props', true, ['Props', 'Doors'])],
    });
    const listId = inputRead('category').getAttribute('list') ?? '';
    const options = [...(document.getElementById(listId)?.querySelectorAll('option') ?? [])].map(
      (option) => option.value,
    );
    expect(options).toEqual(['Props', 'Doors']);
    keyPress('Escape');
  });
});
