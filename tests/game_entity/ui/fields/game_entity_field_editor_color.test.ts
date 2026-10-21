import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorColor } from '@/game_entity/ui/fields/game_entity_field_editor_color.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/** Color editors show sRGB values as a swatch and keep each object's alpha. */
describe('GameEntityFieldEditorColor', () => {
  it('shows the sRGB color and commits picked channels with the current alpha', () => {
    const editor = new GameEntityFieldEditorColor(testDoorField('tint'));
    const edits = editsCapture(editor);
    editor.valuesShow([[1, 0, 0, 0.5]]);
    const input = editor.getElement() as HTMLInputElement;
    expect(input.value).toBe('#ff0000');
    elementChange(input, '#00ff00');
    expect(edits[0]?.([1, 0, 0, 0.5])).toEqual([0, 1, 0, 0.5]);
  });
});
