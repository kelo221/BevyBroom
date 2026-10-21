import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorVector } from '@/game_entity/ui/fields/game_entity_field_editor_vector.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/** Vector editors change one component and keep each object's others. */
describe('GameEntityFieldEditorVector', () => {
  it('commits one component while keeping the other components of each object', () => {
    const editor = new GameEntityFieldEditorVector(testDoorField('open_offset'));
    const edits = editsCapture(editor);
    editor.valuesShow([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    elementChange(editor.getElement().querySelectorAll('input')[2], '9');
    const [edit] = edits;
    expect(edit?.([1, 2, 3])).toEqual([1, 2, 9]);
    expect(edit?.([4, 5, 6])).toEqual([4, 5, 9]);
  });
});
