import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorText } from '@/game_entity/ui/fields/game_entity_field_editor_text.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/** Text editors commit typed text; empty asset paths clear the reference. */
describe('GameEntityFieldEditorText', () => {
  it('shows shared text and commits typed text', () => {
    const editor = new GameEntityFieldEditorText(testDoorField('key_name'));
    const edits = editsCapture(editor);
    editor.valuesShow(['brass']);
    expect((editor.getElement() as HTMLInputElement).value).toBe('brass');
    elementChange(editor.getElement() as HTMLInputElement, 'iron');
    expect(edits.map((edit) => edit('brass'))).toEqual(['iron']);
  });

  it('commits an empty asset path as no asset', () => {
    const editor = new GameEntityFieldEditorText(testDoorField('stats'));
    const edits = editsCapture(editor);
    elementChange(editor.getElement() as HTMLInputElement, '  ');
    expect(edits.map((edit) => edit('old.door.ron'))).toEqual([null]);
  });
});
