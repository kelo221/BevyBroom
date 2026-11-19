import type * as THREE from 'three';
import { EntityOwner } from '@/entity/model/entity_owner.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityDefinition, type GameEntitySettings } from '@/game_entity/owner/game_entity_definition.js';

/** Owner helper of game entities. */
export const GameEntityOwner = new EntityOwner<GameEntitySettings>(new GameEntityDefinition());

/**
 * Creates a game entity carrying a class, by default with all of its defaults
 * and named after the class.
 *
 * @param gameClass Component class the entity starts with.
 * @param components Components the entity carries; the class with no overrides
 *   when left out.
 * @param name Name of the entity; the class label when left out.
 * @returns New game entity owner group.
 */
export function gameEntityCreateForClass(
  gameClass: GameEntityClass,
  components: GameEntityComponents = { [gameClass.type_path]: {} },
  name: string = gameClass.label,
): THREE.Group {
  const owner = GameEntityOwner.createDefault(name);
  GameEntityComponentStore.write(owner, components);
  return owner;
}
