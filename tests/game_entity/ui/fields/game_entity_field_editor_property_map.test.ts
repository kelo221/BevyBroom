import { describe, expect, it } from 'vitest';
import { GameEntityFieldEditorPropertyMap } from '@/game_entity/ui/fields/game_entity_field_editor_property_map.js';
import { gameEntityPropertiesClassCreate } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { editsCapture, elementChange } from './game_entity_field_editor_test_support.js';

/**
 * Returns the property map field of the properties class.
 *
 * @returns Field description.
 */
function valuesField(): ReturnType<typeof gameEntityPropertiesClassCreate>['fields'][number] {
  const [field] = gameEntityPropertiesClassCreate().fields;
  if (!field) throw new Error('the properties class has a field');
  return field;
}

/**
 * Property map editors show one row per property plus an adding row; values are
 * typed by their text.
 */
describe('GameEntityFieldEditorPropertyMap', () => {
  it('shows one row per property and an empty row to add one', () => {
    const editor = new GameEntityFieldEditorPropertyMap(valuesField());
    editor.valuesShow([{ team: 'red', lives: 3 }]);
    const inputs = editor.getElement().querySelectorAll('input');
    expect(inputs).toHaveLength(6);
    expect(inputs[0]?.value).toBe('team');
    expect(inputs[3]?.value).toBe('3');
  });

  it('adds a typed property, renames one and removes one with an empty name', () => {
    const editor = new GameEntityFieldEditorPropertyMap(valuesField());
    const edits = editsCapture(editor);
    editor.valuesShow([{ team: 'red' }]);
    const inputs = editor.getElement().querySelectorAll('input');
    const addingValue = inputs[3];
    if (addingValue) {
      addingValue.value = 'true';
    }
    elementChange(inputs[2], 'boss');
    elementChange(inputs[0], 'side');
    elementChange(inputs[0], '');
    expect(edits.map((edit) => edit(null))).toEqual([{ team: 'red', boss: true }, { side: 'red' }, {}]);
  });

  it('types values by their text', () => {
    expect(GameEntityFieldEditorPropertyMap.valueParse('false')).toBe(false);
    expect(GameEntityFieldEditorPropertyMap.valueParse('2.5')).toBe(2.5);
    expect(GameEntityFieldEditorPropertyMap.valueParse('two')).toBe('two');
    expect(GameEntityFieldEditorPropertyMap.valueParse('')).toBe('');
  });
});
