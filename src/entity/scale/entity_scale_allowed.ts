import type * as THREE from 'three';
import { entityBoundsOwnerOf } from '@/entity/bounds/entity_bounds.js';
import type { EntityDefinition } from '@/entity/model/entity_definition.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';

/** Unit scale that kinds which absorb scale or may not be scaled keep. */
const ENTITY_SCALE_UNIT: readonly [number, number, number] = [1, 1, 1];

/**
 * Returns the scale an object keeps when it becomes an owner of a kind: one on
 * every axis for kinds that absorb scale or may not be scaled, otherwise the
 * given scale.
 *
 * @param definition Rules of the kind the object becomes.
 * @param scale Object scale before the change.
 * @returns Scale the owner keeps.
 */
export function entityScaleKeptFor(
  definition: EntityDefinition<object>,
  scale: readonly [number, number, number],
): readonly [number, number, number] {
  return definition.scaleAbsorbs() || !definition.transformScaleAllowed() ? ENTITY_SCALE_UNIT : scale;
}

/**
 * Returns whether transform edits may scale or resize one selected object: an
 * entity owner, or a clicked entity marker, asks its kind; ordinary objects
 * always may.
 *
 * @param object Selected object.
 * @returns False only for entities whose kind turns scaling off.
 */
export function entityTransformScaleAllowed(object: THREE.Object3D): boolean {
  const owner = entityBoundsOwnerOf(object);
  const entityOwner = owner ? EntityOwnerRegistry.find(owner) : null;
  return entityOwner?.definition.transformScaleAllowed() ?? true;
}

/**
 * Returns whether transform edits may scale or resize a selection: false as
 * soon as one selected object may not be scaled.
 *
 * @param objects Selected objects.
 * @returns True when every object may be scaled.
 */
export function entityTransformScaleAllowedAll(objects: readonly THREE.Object3D[]): boolean {
  return objects.every((object) => entityTransformScaleAllowed(object));
}
