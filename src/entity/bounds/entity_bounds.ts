import type * as THREE from 'three';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityOwnerIs, entityOwnerOfPart, entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';

/**
 * Returns the entity owner a selected object stands for: the owner itself or
 * the owner of a clicked marker.
 *
 * @param object Selected object.
 * @returns The entity owner group, or null for ordinary objects.
 */
export function entityBoundsOwnerOf(object: THREE.Object3D): THREE.Object3D | null {
  if (entityOwnerIs(object)) {
    return object;
  }
  return entityPickMeshIs(object) ? entityOwnerOfPart(object) : null;
}

/**
 * Returns the owner helper of the entity a selected object stands for.
 *
 * @param object Selected object.
 * @returns Owner helper, or null for ordinary objects and unknown kinds.
 */
function entityBoundsHelperOf(object: THREE.Object3D): EntityOwner<object> | null {
  const owner = entityBoundsOwnerOf(object);
  return owner ? EntityOwnerRegistry.find(owner) : null;
}

/**
 * Returns the local selection box the entity kind of a selected marker asks
 * for. The box is in the owner's local space, which is the marker's space.
 *
 * @param object Selected object.
 * @returns Independent local box, or null to measure the object's geometry.
 */
export function entityBoundsLocalOf(object: THREE.Object3D): THREE.Box3 | null {
  const owner = entityBoundsOwnerOf(object);
  const entityOwner = owner ? EntityOwnerRegistry.find(owner) : null;
  const settings = owner && entityOwner ? entityOwner.settingsRead(owner) : null;
  if (!entityOwner || settings === null) {
    return null;
  }
  return entityOwner.definition.boundsLocal(settings)?.clone() ?? null;
}

/**
 * Returns whether the selection bounds of one selected object may be resized.
 * Ordinary objects always may.
 *
 * @param object Selected object.
 * @returns False only for entities whose kind turns resizing off.
 */
export function entityBoundsResizable(object: THREE.Object3D): boolean {
  return entityBoundsHelperOf(object)?.definition.boundsResizable() ?? true;
}

/**
 * Returns whether the selection bounds of a selection offer resizing: true as
 * soon as one selected object may be resized.
 *
 * @param objects Selected objects.
 * @returns True when at least one object may be resized.
 */
export function entityBoundsResizableAny(objects: readonly THREE.Object3D[]): boolean {
  return objects.some((object) => entityBoundsResizable(object));
}
