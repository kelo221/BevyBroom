import type * as THREE from 'three';
import { entityBoundsOwnerOf } from '@/entity/bounds/entity_bounds.js';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { isObjectOrAncestorLocked } from '@/utils/object_lock.js';

/**
 * Returns the distinct, unlocked entity owners a selection stands for.
 *
 * @param selected Selected objects.
 * @returns Owners in selection order, each once.
 */
function entityHandleOwnersOf(selected: readonly THREE.Object3D[]): THREE.Object3D[] {
  const owners = new Set<THREE.Object3D>();
  for (const object of selected) {
    const owner = entityBoundsOwnerOf(object);
    if (owner && !isObjectOrAncestorLocked(owner)) {
      owners.add(owner);
    }
  }
  return [...owners];
}

/**
 * Returns every handle of one owner for its current settings.
 *
 * @param owner Entity owner group.
 * @returns Handle targets, empty for unknown kinds and kinds without handles.
 */
export function entityHandleTargetsOfOwner(owner: THREE.Object3D): EntityHandleTarget[] {
  const entityOwner = EntityOwnerRegistry.find(owner);
  const settings = entityOwner?.settingsRead(owner) ?? null;
  if (!entityOwner || settings === null) {
    return [];
  }
  return entityOwner.definition.handlesCreate(settings).map((handle) => ({ owner, entityOwner, handle }));
}

/**
 * Returns the handles every selected, unlocked entity shows.
 *
 * @param selected Selected objects.
 * @returns Handle targets, grouped by owner.
 */
export function entityHandleTargetsOf(selected: readonly THREE.Object3D[]): EntityHandleTarget[] {
  return entityHandleOwnersOf(selected).flatMap((owner) => entityHandleTargetsOfOwner(owner));
}

/**
 * Returns a key naming each owner and handle of a target list, so two lists
 * with the same handles compare equal.
 *
 * @param targets Handle targets.
 * @returns Stable key.
 */
export function entityHandleTargetsKey(targets: readonly EntityHandleTarget[]): string {
  return targets.map((target) => `${target.owner.uuid}:${target.handle.handleName}`).join('|');
}

/**
 * Returns whether an owner with these settings still has the target's handle.
 *
 * @param target Handle target.
 * @param settings Owner's current settings.
 * @returns True when a handle of that name exists.
 */
export function entityHandleTargetOwned(target: EntityHandleTarget, settings: object): boolean {
  const handles = target.entityOwner.definition.handlesCreate(settings);
  return handles.some((handle) => handle.handleName === target.handle.handleName);
}
