import { describe, expect, it } from 'vitest';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityAddMenuVariantsOf } from '@/game_entity/ui/game_entity_add_menu_variants.js';
import { testDoorClassCreate } from '../game_entity_test_classes.js';

/** Marker box every test variant uses. */
const VARIANT_BOX = { size: [1, 1, 1] as [number, number, number], offset: [0, 0.5, 0] as [number, number, number] };

/**
 * Returns the test door with marker boxes for some values of one field.
 *
 * @param fieldPath Field picking the box.
 * @param values Field values, as text, that have a box.
 * @returns Door class.
 */
function doorPickingBoxesBy(fieldPath: string, values: readonly string[]): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box_field: fieldPath,
    marker_boxes: Object.fromEntries(values.map((value) => [value, VARIANT_BOX])),
  };
}

/**
 * A class that picks its marker box by a field value offers one placeable kind
 * per value that has a box.
 */
describe('gameEntityAddMenuVariantsOf', () => {
  it('offers one kind per boxed value in value order, overriding the field unless it is the default', () => {
    const door = doorPickingBoxesBy('kind', ['Iron', 'Glass', 'Wooden']);
    const kindDefault = door.fields.find((field) => field.path === 'kind')?.default;
    const variants = gameEntityAddMenuVariantsOf(door);
    expect(variants.map((variant) => variant.valueText)).toEqual(['Glass', 'Iron', 'Wooden']);
    for (const variant of variants) {
      const overrides = variant.components[door.type_path] ?? {};
      const expected = variant.valueText === kindDefault ? {} : { kind: variant.valueText };
      expect(overrides).toEqual(expected);
    }
  });

  it('turns values of number and boolean fields back into numbers and booleans', () => {
    const byUses = gameEntityAddMenuVariantsOf(doorPickingBoxesBy('uses', ['12']));
    expect(byUses[0]?.components[testDoorClassCreate().type_path]).toEqual({ uses: 12 });
    const byLocked = gameEntityAddMenuVariantsOf(doorPickingBoxesBy('locked', ['true']));
    expect(byLocked[0]?.components[testDoorClassCreate().type_path]).toEqual({ locked: true });
  });

  it('offers nothing when the class picks no box by a field it lists', () => {
    expect(gameEntityAddMenuVariantsOf(testDoorClassCreate())).toEqual([]);
    expect(gameEntityAddMenuVariantsOf(doorPickingBoxesBy('missing_field', ['Iron']))).toEqual([]);
  });
});
