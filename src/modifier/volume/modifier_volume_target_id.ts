import type * as THREE from 'three';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';

/**
 * Returns the id a modifier volume uses to name an object it may affect: the
 * brush id of a solid brush mesh, which survives reloads, undo and rebuilds,
 * and the uuid of any other object.
 *
 * @param object Scene object.
 * @returns Target id.
 */
export function modifierVolumeTargetIdRead(object: THREE.Object3D): string {
  return SolidBrushVisual.getBrushId(object) ?? object.uuid;
}

/**
 * Finds the object at or under a root that a target id names.
 *
 * @param root Object to search from, itself included.
 * @param targetId Target id.
 * @returns The first matching object in traversal order, or undefined.
 */
export function modifierVolumeTargetFind(root: THREE.Object3D, targetId: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (!found && modifierVolumeTargetIdRead(object) === targetId) found = object;
  });
  return found;
}
