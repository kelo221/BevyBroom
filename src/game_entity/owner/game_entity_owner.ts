import type * as THREE from 'three';
import { EntityOwner } from '@/entity/model/entity_owner.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityDefinition, type GameEntitySettings } from '@/game_entity/owner/game_entity_definition.js';

/** Owner helper of game entities. */
export const GameEntityOwner = new EntityOwner<GameEntitySettings>(new GameEntityDefinition());

/**
 * Creates a game entity named after a class and carrying that class with all of
 * its defaults.
 *
 * @param gameClass Component class the entity starts with.
 * @returns New game entity owner group.
 */
export function gameEntityCreateForClass(gameClass: GameEntityClass): THREE.Group {
  const owner = GameEntityOwner.createDefault(gameClass.label);
  GameEntityComponentStore.write(owner, { [gameClass.type_path]: {} });
  return owner;
}
