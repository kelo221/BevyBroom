import type * as THREE from 'three';
import { objectInOmittedLayerIs } from '@/layer/model/layer_membership.js';

/**
 * Decides which scene objects reach a level export: visible objects outside the
 * layers left out of exports.
 */
export class LevelExportObjectFilter {
  /**
   * Returns whether neither an object nor any parent up to the world sits in a
   * layer left out of exports.
   *
   * @param object Scene object.
   * @param worldGroup World root the walk stops at.
   * @returns True when the object is exported.
   */
  static exportedIs(object: THREE.Object3D, worldGroup: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current !== null && current !== worldGroup) {
      if (objectInOmittedLayerIs(current)) {
        return false;
      }
      current = current.parent;
    }
    return true;
  }
}
