import type * as THREE from 'three';

/** UserData flag on meshes that keep their own material in every shading mode. */
export const SHADING_EXEMPT_USERDATA_KEY = 'isShadingExempt';

/**
 * Makes a mesh keep its own material in every shading mode, so it draws the
 * same in solid, flat and wireframe panes.
 *
 * @param object Mesh or other object to flag.
 */
export function shadingExemptFlag(object: THREE.Object3D): void {
  object.userData[SHADING_EXEMPT_USERDATA_KEY] = true;
}

/**
 * Returns whether an object was flagged to keep its own material.
 *
 * @param object Candidate object.
 * @returns True for flagged objects.
 */
export function shadingExemptIs(object: THREE.Object3D): boolean {
  return object.userData[SHADING_EXEMPT_USERDATA_KEY] === true;
}
