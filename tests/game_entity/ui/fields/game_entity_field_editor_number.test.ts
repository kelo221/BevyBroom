import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorNumber } from '@/game_entity/ui/fields/game_entity_field_editor_number.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/** Number editors show shared numbers and commit typed math as a value. */
describe('GameEntityFieldEditorNumber', () => {
  it('shows shared numbers and commits evaluated math', () => {
    const editor = new GameEntityFieldEditorNumber(testDoorField('speed'));
    const edits = editsCapture(editor);
    editor.valuesShow([2.5, 2.5]);
    const input = editor.getElement() as HTMLInputElement;
    expect(Number(input.value)).toBe(2.5);
    elementChange(input, '2 * 3');
    expect(edits.map((edit) => edit(0))).toEqual([6]);
  });

  it('ignores text that is not a number', () => {
    const editor = new GameEntityFieldEditorNumber(testDoorField('uses'));
    const edits = editsCapture(editor);
    elementChange(editor.getElement() as HTMLInputElement, 'many');
    expect(edits).toHaveLength(0);
  });
});
