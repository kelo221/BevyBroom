import { describe, expect, it } from 'vitest';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentBoxNote } from '@/game_entity/ui/game_entity_component_box_note.js';
import { testDoorClassCreate } from '../game_entity_test_classes.js';

/**
 * Returns the test door class with a plain box and a wider box picked by its
 * kind field.
 *
 * @returns Door class with marker boxes.
 */
function doorClassWithBoxes(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box: { size: [1, 2, 0.25], offset: [0, 1, 0] },
    marker_box_field: 'kind',
    marker_boxes: { Iron: { size: [3, 2.5, 0.4], offset: [1.5, 1.25, 0] } },
  };
}

/**
 * The inspector names the box a class gives the selected objects, so a level
 * designer can read the size the game uses and the field that picks it.
 */
describe('GameEntityComponentBoxNote', () => {
  it('shows the size of the box and the field that picks it', () => {
    const door = doorClassWithBoxes();
    const kindField = door.fields.find((field) => field.path === 'kind');
    const text = GameEntityComponentBoxNote.textOf(door, [{ [door.type_path]: { kind: 'Iron' } }]);
    expect(text).toContain(door.marker_boxes?.['Iron']?.size.join(' × '));
    expect(text).toContain(`set by ${kindField?.label}`);
  });

  it('says when the selected objects have different boxes', () => {
    const door = doorClassWithBoxes();
    const text = GameEntityComponentBoxNote.textOf(door, [
      { [door.type_path]: { kind: 'Iron' } },
      { [door.type_path]: {} },
    ]);
    expect(text).toContain('differs per object');
  });

  it('shows nothing for classes without boxes or unknown to the editor', () => {
    const door = testDoorClassCreate();
    expect(GameEntityComponentBoxNote.textOf(door, [{ [door.type_path]: {} }])).toBeNull();
    expect(GameEntityComponentBoxNote.textOf(null, [{ [door.type_path]: {} }])).toBeNull();
  });
});
