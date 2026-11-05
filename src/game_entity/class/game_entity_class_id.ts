/** Prefix of the catalog and class ids of entries that stand for one game class. */
export const GAME_ENTITY_CLASS_ID_PREFIX = 'game_entity.class.';

/**
 * Returns the catalog and class id of a game class.
 *
 * @param typePath Component type path.
 * @returns Id such as `game_entity.class.game::doors::Door`.
 */
export function gameEntityClassIdOf(typePath: string): string {
  return `${GAME_ENTITY_CLASS_ID_PREFIX}${typePath}`;
}
