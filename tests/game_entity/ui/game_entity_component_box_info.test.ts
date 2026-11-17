import { describe, expect, it } from 'vitest';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentBlock } from '@/game_entity/ui/game_entity_component_block.js';
import { GameEntityComponentBoxInfo } from '@/game_entity/ui/game_entity_component_box_info.js';
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
 * The inspector shows the box a class gives the selected objects as a read-only
 * row, so a level designer can read the size the game uses and the field that
 * picks it.
 */
describe('GameEntityComponentBoxInfo', () => {
  it('shows the size of the picked box and names the field that picks it', () => {
    const door = doorClassWithBoxes();
    const kindField = door.fields.find((field) => field.path === 'kind');
    const row = GameEntityComponentBoxInfo.rowOf(door, [{ [door.type_path]: { kind: 'Iron' } }]);
    expect(row?.valueText).toContain(door.marker_boxes?.['Iron']?.size.join(' × '));
    expect(row?.helpText).toContain(`${kindField?.label}`);
  });

  it('says when the selected objects have different boxes', () => {
    const door = doorClassWithBoxes();
    const row = GameEntityComponentBoxInfo.rowOf(door, [
      { [door.type_path]: { kind: 'Iron' } },
      { [door.type_path]: {} },
    ]);
    expect(row?.valueText).toBe('differs per object');
  });

  it('shows nothing for classes without boxes or unknown to the editor', () => {
    const door = testDoorClassCreate();
    expect(GameEntityComponentBoxInfo.rowOf(door, [{ [door.type_path]: {} }])).toBeNull();
    expect(GameEntityComponentBoxInfo.rowOf(null, [{ [door.type_path]: {} }])).toBeNull();
  });

  it('adds a read-only row beside the field rows of the component block', () => {
    const door = doorClassWithBoxes();
    const block = new GameEntityComponentBlock(door.type_path, [{ [door.type_path]: {} }], () => {}, {
      gameClass: door,
    });
    const boxRow = block.getElement().querySelector<HTMLElement>('[data-read-only="true"]');
    expect(boxRow?.textContent).toContain(door.marker_box?.size.join(' × '));
    expect(boxRow?.querySelector('input')).toBeNull();
  });
});
