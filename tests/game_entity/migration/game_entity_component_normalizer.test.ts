import { describe, expect, it } from 'vitest';
import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentNormalizer } from '@/game_entity/migration/game_entity_component_normalizer.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_RENAMES,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassCreate,
} from '../game_entity_test_class_enum_list.js';

/** Old type path of the shelf class, renamed into the stock fixture. */
const OLD_SHELF = 'store::Shelf';

/** Type path of the store prop class, which keeps non-stock props. */
const STORE_PROP = 'store::StoreProp';

/** Type path of the stock fixture class. */
const STOCK_FIXTURE = 'store::StockFixture';

/**
 * Returns an enum fixture field.
 *
 * @param variants Values the field lists.
 * @param defaultValue Default value.
 * @returns Field.
 */
function fixtureFieldCreate(variants: string[], defaultValue: string): GameEntityField {
  return { path: 'fixture', label: 'Fixture', kind: 'enum', default: defaultValue, variants };
}

/**
 * Returns a class with one fixture field.
 *
 * @param typePath Type path.
 * @param field Fixture field.
 * @returns Class.
 */
function classCreate(typePath: string, field: GameEntityField): GameEntityClass {
  return {
    type_path: typePath,
    label: typePath.split('::').pop() ?? typePath,
    category: 'Store',
    placement: 'point',
    marker_color: [1, 1, 1],
    fields: [field],
  };
}

/**
 * Returns the current classes after the stock fixture rename: the stock fixture
 * was renamed from the shelf, takes over fridges and shelves from the store
 * prop, and renamed the shop shelf id.
 *
 * @returns Current classes.
 */
function currentClassesCreate(): GameEntityClass[] {
  const stockField = fixtureFieldCreate(['shop-shelf-4', 'big-fridge', 'dev-shelf-tall-4'], 'shop-shelf-4');
  stockField.renamed_variants = { 'shop-shelf': 'shop-shelf-4', 'shelf-tall-4': 'dev-shelf-tall-4' };
  const stockFixture: GameEntityClass = {
    ...classCreate(STOCK_FIXTURE, stockField),
    renamed_from: [OLD_SHELF],
    absorbs: [{ from: STORE_PROP, field: 'fixture', variants: ['big-fridge', 'shop-shelf'], default: 'big-fridge' }],
  };
  const storeProp = classCreate(STORE_PROP, fixtureFieldCreate(['checkout-counter', 'gate'], 'checkout-counter'));
  return [stockFixture, storeProp];
}

/**
 * Returns the classes as an old level's copy knew them.
 *
 * @returns Former classes.
 */
function formerClassesCreate(): GameEntityClass[] {
  return [
    classCreate(OLD_SHELF, fixtureFieldCreate(['shelf-tall-4', 'shop-shelf'], 'shelf-tall-4')),
    classCreate(STORE_PROP, fixtureFieldCreate(['big-fridge', 'checkout-counter', 'shop-shelf'], 'big-fridge')),
  ];
}

/**
 * Old components follow class renames, absorbed classes, renamed enum values
 * and default changes to what they meant when they were saved, and every enum
 * value ends up written out.
 */
describe('GameEntityComponentNormalizer', () => {
  const normalizer = new GameEntityComponentNormalizer(currentClassesCreate(), formerClassesCreate());

  it('moves a renamed class and keeps what its left-out field meant under the old default', () => {
    const result = normalizer.normalize({ [OLD_SHELF]: {} });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'dev-shelf-tall-4' } });
    expect(result.rewrites.map((rewrite) => rewrite.kind)).toEqual(['class', 'variant']);
  });

  it('moves components another class absorbs by their value and renames the value', () => {
    const result = normalizer.normalize({ [STORE_PROP]: { fixture: 'shop-shelf' } });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
    expect(result.rewrites[0]?.description).toContain('became');
  });

  it("resolves an old empty component to the absorbing rule's old default, not today's default", () => {
    const result = normalizer.normalize({ [STORE_PROP]: {} });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'big-fridge' } });
  });

  it('keeps props the absorbing class does not list and writes in left-out enum values with a note', () => {
    expect(normalizer.normalize({ [STORE_PROP]: { fixture: 'gate' } })).toEqual({
      components: { [STORE_PROP]: { fixture: 'gate' } },
      rewrites: [],
    });
    const fresh = new GameEntityComponentNormalizer(currentClassesCreate(), []);
    const filled = fresh.normalize({ [STOCK_FIXTURE]: {} });
    expect(filled.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
    expect(filled.rewrites.map((rewrite) => rewrite.kind)).toEqual(['default']);
    expect(filled.rewrites[0]?.description).toContain('filled from the class default');
  });

  it('lets a stored value beat a filled-in old default whichever old component comes first', () => {
    const result = normalizer.normalize({ [OLD_SHELF]: {}, [STORE_PROP]: { fixture: 'shop-shelf' } });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
  });

  it('merges two old components moving into one class, the explicit value winning', () => {
    const result = normalizer.normalize({
      [OLD_SHELF]: { fixture: 'shop-shelf' },
      [STORE_PROP]: { fixture: 'shop-shelf' },
    });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'shop-shelf-4' } });
  });

  it('uses the old defaults a rename names when no copy of the old class is known', () => {
    const classes = currentClassesCreate();
    const stockFixture = classes[0];
    if (stockFixture === undefined) {
      throw new Error('the stock fixture class exists');
    }
    stockFixture.renamed_from = [{ type_path: OLD_SHELF, defaults: { fixture: 'shelf-tall-4' } }];
    const result = new GameEntityComponentNormalizer(classes, []).normalize({ [OLD_SHELF]: {} });
    expect(result.components).toEqual({ [STOCK_FIXTURE]: { fixture: 'dev-shelf-tall-4' } });
  });

  it('keeps components of unknown classes as they are and leaves current components alone', () => {
    const components = { 'other::Thing': { size: 3 }, [STOCK_FIXTURE]: { fixture: 'big-fridge' } };
    expect(normalizer.normalize(components)).toEqual({ components, rewrites: [] });
  });
});

/**
 * Enum list fields rename each old entry, keep their order, collapse entries
 * renames make equal and get their default written in when left out.
 */
describe('GameEntityComponentNormalizer enum lists', () => {
  const shelfRun = testShelfRunClassCreate();
  const normalizer = new GameEntityComponentNormalizer([shelfRun], []);
  const [oldName = '', newName = ''] = Object.entries(TEST_SHELF_RUN_RENAMES)[0] ?? [];
  const kept = TEST_SHELF_RUN_VARIANTS.find((variant) => variant !== newName) ?? '';

  it('renames every old entry in place and names the change', () => {
    const result = normalizer.normalize({
      [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [kept, oldName] },
    });
    expect(result.components[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]).toEqual([kept, newName]);
    expect(result.rewrites.map((rewrite) => rewrite.kind)).toEqual(['variant']);
    expect(result.rewrites[0]?.description).toContain(newName);
  });

  it('keeps the first of two entries a rename makes equal', () => {
    const result = normalizer.normalize({
      [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [newName, kept, oldName] },
    });
    expect(result.components[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]).toEqual([newName, kept]);
  });

  it('writes in the default list when left out and leaves current lists alone', () => {
    const filled = normalizer.normalize({ [TEST_SHELF_RUN_TYPE_PATH]: {} });
    const listField = shelfRun.fields.find((field) => field.path === TEST_SHELF_RUN_LIST_PATH);
    expect(filled.components[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]).toEqual(listField?.default);
    expect(filled.rewrites.map((rewrite) => rewrite.kind)).toEqual(['default']);
    const current = { [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [kept], blocked: true } };
    expect(normalizer.normalize(current)).toEqual({ components: current, rewrites: [] });
  });
});
