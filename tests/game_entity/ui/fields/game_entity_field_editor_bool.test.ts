import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorBool } from '@/game_entity/ui/fields/game_entity_field_editor_bool.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture } from './game_entity_field_editor_test_support.js';

/** Boolean editors show shared states and commit the toggled state. */
describe('GameEntityFieldEditorBool', () => {
  it('commits the new state of the box', () => {
    const editor = new GameEntityFieldEditorBool(testDoorField('locked'));
    const edits = editsCapture(editor);
    editor.valuesShow([false]);
    (editor.getElement() as HTMLInputElement).click();
    expect(edits.map((edit) => edit(false))).toEqual([true]);
  });

  it('shows mixed states as indeterminate', () => {
    const editor = new GameEntityFieldEditorBool(testDoorField('locked'));
    editor.valuesShow([true, false]);
    expect((editor.getElement() as HTMLInputElement).indeterminate).toBe(true);
  });
});
