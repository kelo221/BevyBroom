import { describe, expect, it } from 'vitest';
import { GameEntityComponentValueList } from '@/game_entity/component/game_entity_component_value_list.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassCreate,
} from '../game_entity_test_class_enum_list.js';

/**
 * Returns the enum list field of the test shelf run.
 *
 * @returns Field.
 */
function listFieldOf(): ReturnType<typeof testShelfRunClassCreate>['fields'][number] {
  const field = testShelfRunClassCreate().fields.find((candidate) => candidate.path === TEST_SHELF_RUN_LIST_PATH);
  if (!field) {
    throw new Error('the shelf run has its list field');
  }
  return field;
}

/**
 * Enum list values read as ordered variant names, falling back to the class
 * default, and every edit keeps the names distinct.
 */
describe('GameEntityComponentValueList', () => {
  it('reads the override, else the default, in order', () => {
    const field = listFieldOf();
    const reversed = [...TEST_SHELF_RUN_VARIANTS].reverse();
    const overridden = { [TEST_SHELF_RUN_TYPE_PATH]: { [field.path]: reversed } };
    expect(GameEntityComponentValueList.variantsEffective(overridden, TEST_SHELF_RUN_TYPE_PATH, field)).toEqual(
      reversed,
    );
    expect(GameEntityComponentValueList.variantsEffective({}, TEST_SHELF_RUN_TYPE_PATH, field)).toEqual(field.default);
    expect(GameEntityComponentValueList.variantsOf([1, 2])).toEqual([]);
    expect(GameEntityComponentValueList.variantsOf('cereal')).toEqual([]);
  });

  it('appends a name once and removes it', () => {
    const [first = '', second = ''] = TEST_SHELF_RUN_VARIANTS;
    const appended = GameEntityComponentValueList.variantAppend([first], second);
    expect(appended).toEqual([first, second]);
    expect(GameEntityComponentValueList.variantAppend(appended, first)).toEqual(appended);
    expect(GameEntityComponentValueList.variantRemove(appended, first)).toEqual([second]);
  });

  it('moves a name by places and stops at either end', () => {
    const list = TEST_SHELF_RUN_VARIANTS.slice(0, 3);
    const [first = '', second = '', third = ''] = list;
    expect(GameEntityComponentValueList.variantMove(list, third, -1)).toEqual([first, third, second]);
    expect(GameEntityComponentValueList.variantMove(list, first, 1)).toEqual([second, first, third]);
    expect(GameEntityComponentValueList.variantMove(list, first, -5)).toEqual(list);
    expect(GameEntityComponentValueList.variantMove(list, first, 9)).toEqual([second, third, first]);
    expect(GameEntityComponentValueList.variantMove(list, 'missing', 1)).toEqual(list);
  });

  it('names the held variants the field does not list', () => {
    const field = listFieldOf();
    const dropped = `dropped-${Math.floor(Math.random() * 1000)}`;
    const held = [TEST_SHELF_RUN_VARIANTS[0] ?? '', dropped];
    expect(GameEntityComponentValueList.variantsUnknown(field, held)).toEqual([dropped]);
    expect(GameEntityComponentValueList.variantsUnknown({ ...field, variants: [] }, held)).toEqual([]);
  });
});
