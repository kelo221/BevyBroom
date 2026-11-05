import type { EntityClass } from '@/entity/class/entity_class.js';
import { EntityClassBrushGame } from '@/entity/class/classes/entity_class_brush_game.js';
import { EntityClassBrushSolidWorld } from '@/entity/class/classes/entity_class_brush_solid_world.js';
import { EntityClassPointEntityOwner } from '@/entity/class/classes/entity_class_point_entity_owner.js';
import { EntityClassPointGame } from '@/entity/class/classes/entity_class_point_game.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';

/** Returns the classes one source currently offers. */
export type EntityClassProvider = () => readonly EntityClass[];

/**
 * Returns the class sources the editor ships with, in display order.
 *
 * @returns Class providers.
 */
export function entityClassProvidersBuiltin(): readonly EntityClassProvider[] {
  return [entityClassProviderEntityOwners, entityClassProviderGamePoints, entityClassProviderBrushes];
}

/**
 * Returns the point classes every registered entity kind offers.
 *
 * @returns Entity owner classes in kind order.
 */
function entityClassProviderEntityOwners(): readonly EntityClass[] {
  return EntityOwnerRegistry.list().flatMap((entityOwner) =>
    entityOwner.definition.pointClassVariants().map((variant) => new EntityClassPointEntityOwner(entityOwner, variant)),
  );
}

/**
 * Returns one point class per game class the editor knows.
 *
 * @returns Game point classes sorted by category and label.
 */
function entityClassProviderGamePoints(): readonly EntityClass[] {
  return GameEntityClassRegistry.classesList().map((gameClass) => new EntityClassPointGame(gameClass));
}

/**
 * Returns the brush classes: game classes that may be placed on brushes, then
 * plain world brushes.
 *
 * @returns Brush classes.
 */
function entityClassProviderBrushes(): readonly EntityClass[] {
  const brushGameClasses = GameEntityClassRegistry.classesList().filter((gameClass) => gameClass.placement === 'any');
  return [
    ...brushGameClasses.map((gameClass) => new EntityClassBrushGame(gameClass)),
    new EntityClassBrushSolidWorld(),
  ];
}
