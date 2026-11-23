import { gameEntityClassFromUnknown, type GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';

/** Type path of the test volume class with an enum list field. */
export const TEST_SHELF_RUN_TYPE_PATH = 'test_game::store::ShelfRun';

/** Path of the shelf run's enum list field. */
export const TEST_SHELF_RUN_LIST_PATH = 'categories';

/** Variants the shelf run's enum list field lists. */
export const TEST_SHELF_RUN_VARIANTS = ['bottles', 'cereal', 'generic', 'storage', 'tins'];

/** Old variant names of the shelf run's enum list field, by old name. */
export const TEST_SHELF_RUN_RENAMES: Record<string, string> = { cans: 'tins', boxes: 'cereal' };

/**
 * Returns the shelf run class as a class file declares it: a volume with an
 * ordered list of categories, two of them named and grouped, and a blocked
 * flag.
 *
 * @returns Untrusted class record.
 */
export function testShelfRunClassJson(): Record<string, unknown> {
  return {
    type_path: TEST_SHELF_RUN_TYPE_PATH,
    label: 'Shelf Run',
    category: 'Store',
    placement: 'any',
    collision: 'volume',
    marker_color: [0.3, 0.55, 0.9],
    fields: [
      {
        path: TEST_SHELF_RUN_LIST_PATH,
        label: 'Categories',
        kind: 'enum_list',
        default: ['generic'],
        variants: [...TEST_SHELF_RUN_VARIANTS],
        variant_details: {
          cereal: { label: 'Cereal', group: 'Dry goods' },
          tins: { label: 'Tins', group: 'Dry goods' },
        },
        renamed_variants: { ...TEST_SHELF_RUN_RENAMES },
      },
      { path: 'blocked', label: 'Blocked off', kind: 'bool', default: false },
    ],
  };
}

/**
 * Returns the shelf run class as the editor reads it.
 *
 * @returns Class.
 * @throws Error when the class does not read.
 */
export function testShelfRunClassCreate(): GameEntityClass {
  const gameClass = gameEntityClassFromUnknown(testShelfRunClassJson());
  if (gameClass === null) {
    throw new Error('the shelf run class reads');
  }
  return gameClass;
}
