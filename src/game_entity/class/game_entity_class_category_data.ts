import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';

/** Category the bridge files its data-only components under, such as Properties. */
export const GAME_ENTITY_CLASS_CATEGORY_DATA = 'Data';

/**
 * Category the editor files data asset types under when it shows them as
 * classes.
 */
export const GAME_ENTITY_CLASS_CATEGORY_DATA_ASSETS = 'Data Assets';

/** Categories whose classes only carry data and are never placed on their own. */
const GAME_ENTITY_CLASS_DATA_CATEGORIES: ReadonlySet<string> = new Set([
  GAME_ENTITY_CLASS_CATEGORY_DATA,
  GAME_ENTITY_CLASS_CATEGORY_DATA_ASSETS,
]);

/**
 * Returns whether a game class only carries data, so it is attached to other
 * objects but never placed as an entity of its own.
 *
 * @param gameClass Game component class.
 * @returns True for classes of a data category.
 */
export function gameEntityClassIsDataOnly(gameClass: GameEntityClass): boolean {
  return GAME_ENTITY_CLASS_DATA_CATEGORIES.has(gameClass.category);
}
