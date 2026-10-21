import * as THREE from 'three';

/** Box brush edge lengths: one length for a cube, or width, height and depth. */
export type SolidBoxSize = number | THREE.Vector3;

/**
 * Returns the width, height and depth of a box brush size.
 *
 * @param size Cube edge length, or per-axis edge lengths.
 * @returns New vector holding the X, Y and Z edge lengths.
 */
export function solidBoxSizeVectorResolve(size: SolidBoxSize): THREE.Vector3 {
  if (typeof size === 'number') {
    return new THREE.Vector3(size, size, size);
  }
  return size.clone();
}

/**
 * Returns the longest edge of a box brush size.
 *
 * @param size Cube edge length, or per-axis edge lengths.
 * @returns Longest edge length.
 */
export function solidBoxSizeLongestEdge(size: SolidBoxSize): number {
  const vector = solidBoxSizeVectorResolve(size);
  return Math.max(vector.x, vector.y, vector.z);
}
