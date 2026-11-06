import type * as THREE from 'three';

/**
 * UserData key marking an object as an editor-only displacement viewport
 * helper.
 */
export const DISPLACEMENT_OVERLAY_HELPER_USERDATA_KEY = 'isDisplacementOverlayHelper';

/** Raycast replacement that never reports intersections. */
function displacementOverlayRaycastIgnore(): void {}

/**
 * Marks an object and its descendants as editor-only displacement helpers that
 * raycasts never hit.
 *
 * @param object Helper object to mark.
 */
export function displacementOverlayHelperMark(object: THREE.Object3D): void {
  object.traverse((child) => {
    child.userData[DISPLACEMENT_OVERLAY_HELPER_USERDATA_KEY] = true;
    child.raycast = displacementOverlayRaycastIgnore;
  });
}

/**
 * Returns whether an object is an editor-only displacement helper.
 *
 * @param object Candidate object.
 * @returns True when the object carries the displacement helper mark.
 */
export function displacementOverlayHelperIs(object: THREE.Object3D): boolean {
  return object.userData[DISPLACEMENT_OVERLAY_HELPER_USERDATA_KEY] === true;
}
