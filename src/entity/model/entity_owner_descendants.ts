import type * as THREE from 'three';
import { entityPickDisabledIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';

/**
 * Collects the entity owners that pass a test at or below a root, such as the
 * lights inside fixture groups or nested in a fixture entity. A root that
 * passes counts itself. Below the root an accepted owner ends the search along
 * its branch, and objects that turned clicking off, such as array copies
 * rebuilt from their source, are left out with everything below them, like
 * entity visuals.
 *
 * @param root Object to search from.
 * @param ownerAccept Returns true for the owners to collect.
 * @returns Accepted owners in scene order.
 */
export function entityOwnerDescendantsCollect(
  root: THREE.Object3D,
  ownerAccept: (object: THREE.Object3D) => boolean,
): THREE.Object3D[] {
  if (ownerAccept(root)) {
    return [root];
  }
  const owners: THREE.Object3D[] = [];
  root.children.forEach((child) => entityOwnerDescendantsAppend(child, ownerAccept, owners));
  return owners;
}

/**
 * Appends the object when it is an accepted owner, or searches its children,
 * unless it is left out or an editor visual.
 *
 * @param object Object to visit.
 * @param ownerAccept Returns true for the owners to collect.
 * @param owners Accumulator of accepted owners.
 */
function entityOwnerDescendantsAppend(
  object: THREE.Object3D,
  ownerAccept: (object: THREE.Object3D) => boolean,
  owners: THREE.Object3D[],
): void {
  if (entityPickDisabledIs(object) || entityVisualPartIs(object)) {
    return;
  }
  if (ownerAccept(object)) {
    owners.push(object);
    return;
  }
  object.children.forEach((child) => entityOwnerDescendantsAppend(child, ownerAccept, owners));
}
