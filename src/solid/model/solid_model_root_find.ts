import * as THREE from 'three';
import { isSolidModelObject } from './solid_model_keys.js';

/**
 * Walks the parents of an object to the nearest solid model root.
 *
 * @param object Object inside a solid model, for example a brush mesh.
 * @returns Solid model root group, or null when the object is not under one.
 */
export function solidModelRootFind(object: THREE.Object3D): THREE.Group | null {
  let current: THREE.Object3D | null = object.parent;
  while (current) {
    if (current instanceof THREE.Group && isSolidModelObject(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Returns the id whose stable 2D wire color the edges of a brush use: the uuid
 * of its solid model root, or the brush's own uuid outside a solid model.
 *
 * @param brushMesh Brush preview mesh.
 * @returns Wire color owner id.
 */
export function solidBrushWireOwnerIdRead(brushMesh: THREE.Object3D): string {
  return solidModelRootFind(brushMesh)?.uuid ?? brushMesh.uuid;
}
