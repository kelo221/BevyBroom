import type * as THREE from 'three';
import { type EntityClass, EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';

/**
 * Finds the class a typed text names: by label, ignoring case, else by id.
 *
 * @param classes Classes to search.
 * @param text Typed or picked text.
 * @returns The class, or null when none is named.
 */
export function entityClassFindByText(classes: readonly EntityClass[], text: string): EntityClass | null {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') {
    return null;
  }
  const byLabel = classes.find((entityClass) => entityClass.label.toLowerCase() === wanted);
  return byLabel ?? classes.find((entityClass) => entityClass.id.toLowerCase() === wanted) ?? null;
}

/**
 * Returns whether converting into a class is offered: not for point classes
 * that are never placed on their own.
 *
 * @param entityClass Candidate class.
 * @returns False for point classes that are not placeable.
 */
export function entityClassOfferedIs(entityClass: EntityClass): boolean {
  return !(entityClass instanceof EntityClassPoint) || entityClass.placeableIs();
}

/**
 * Returns the classes every object may be converted into: the fitting classes
 * except point classes that are never placed on their own.
 *
 * @param objects Edited objects.
 * @returns Classes in display order; empty without objects.
 */
export function entityClassesFittingAll(objects: readonly THREE.Object3D[]): EntityClass[] {
  const [first, ...others] = objects;
  if (!first) {
    return [];
  }
  return EntityClassRegistry.classesFittingList(first).filter(
    (entityClass) => entityClassOfferedIs(entityClass) && others.every((object) => entityClass.canApplyTo(object)),
  );
}
