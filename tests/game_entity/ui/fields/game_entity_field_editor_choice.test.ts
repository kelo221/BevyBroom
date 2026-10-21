import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorChoice } from '@/game_entity/ui/fields/game_entity_field_editor_choice.js';
import { testDoorField } from '../../game_entity_test_classes.js';
import { editsCapture } from './game_entity_field_editor_test_support.js';

/**
 * Returns the option values of a select.
 *
 * @param element Select element.
 * @returns Option values in order, without the hidden mixed entry.
 */
function optionValues(element: HTMLElement): string[] {
  return [...(element as HTMLSelectElement).options].filter((option) => !option.hidden).map((option) => option.value);
}

/** Choice editors list enum variants or asset files and commit the chosen one. */
describe('GameEntityFieldEditorChoice', () => {
  it('lists enum variants and commits the chosen variant', () => {
    const field = testDoorField('kind');
    const editor = new GameEntityFieldEditorChoice(field, field.variants ?? []);
    const edits = editsCapture(editor);
    editor.valuesShow([field.default]);
    expect(optionValues(editor.getElement())).toEqual(field.variants);
    const select = editor.getElement() as HTMLSelectElement;
    select.value = field.variants?.[2] ?? '';
    select.dispatchEvent(new Event('change'));
    expect(edits.map((edit) => edit(field.default))).toEqual([field.variants?.[2]]);
  });

  it('offers no asset, the listed files and a file still in use', () => {
    const paths = ['data/a.door.ron', 'data/b.door.ron'];
    const editor = new GameEntityFieldEditorChoice(testDoorField('stats'), paths);
    const edits = editsCapture(editor);
    editor.valuesShow(['data/removed.door.ron']);
    const values = optionValues(editor.getElement());
    expect(values).toHaveLength(paths.length + 2);
    expect(values).toContain('data/removed.door.ron');
    const select = editor.getElement() as HTMLSelectElement;
    select.value = values[0] ?? '';
    select.dispatchEvent(new Event('change'));
    expect(edits.map((edit) => edit('data/removed.door.ron'))).toEqual([null]);
  });
});
