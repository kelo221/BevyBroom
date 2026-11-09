import * as THREE from 'three';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import { getCadViewPlaneAxes } from '@/rulers/view/cad_view_plane.js';

/** UserData key for the face half-extent along its axis (local). */
export const BOUNDS_HANDLE_FACE_HALF_KEY = 'boundsHandleFaceHalf';

/**
 * Builds a unit box used as the invisible 3D bounds-arrow pick volume.
 *
 * @returns Unit cube geometry centered at the origin.
 */
export function createBoundsHandlePickVolumeGeometry(): THREE.BoxGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

/**
 * Returns the local unit depth axis for an orthographic view plane.
 *
 * @param viewPlane Orthographic plane (`xz` / `xy` / `yz`).
 * @returns Depth direction in local bounds space, or null for full 3D.
 */
export function getViewPlaneDepthDirection(viewPlane: CadViewPlane): THREE.Vector3 | null {
  const { depthAxis } = getCadViewPlaneAxes(viewPlane);
  if (depthAxis === null) return null;
  if (depthAxis === 0) return new THREE.Vector3(1, 0, 0);
  if (depthAxis === 1) return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}
