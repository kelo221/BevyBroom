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

/** UserData flag on exempt meshes that the Lit shading mode still lights. */
export const SHADING_LIT_INCLUDED_USERDATA_KEY = 'isShadingLitIncluded';

/**
 * Makes a mesh that keeps its own material in the other shading modes take the
 * scene lights in the Lit mode, because the game draws it as lit geometry.
 *
 * @param object Mesh or other object to flag.
 */
export function shadingLitIncludedFlag(object: THREE.Object3D): void {
  object.userData[SHADING_LIT_INCLUDED_USERDATA_KEY] = true;
}

/**
 * Returns whether an object was flagged to take the scene lights in the Lit
 * mode.
 *
 * @param object Candidate object.
 * @returns True for flagged objects.
 */
export function shadingLitIncludedIs(object: THREE.Object3D): boolean {
  return object.userData[SHADING_LIT_INCLUDED_USERDATA_KEY] === true;
}
