import * as THREE from 'three';
import type { SprinklePrng } from '@/tools/sprinkle/sprinkle_prng.js';

/** World up axis entities are placed around. */
const SPRINKLE_ORIENTATION_UP = new THREE.Vector3(0, 1, 0);

/** Orientation choices of a stroke. */
export interface SprinkleOrientationOptions {
  /** Whether entities spin by a random angle around their up axis. */
  readonly randomYaw: boolean;
  /** Whether entities tilt their +Y axis onto the surface normal. */
  readonly alignToNormal: boolean;
}

/**
 * Computes the world orientation of a sprinkled entity: a yaw around +Y, random
 * when asked, then a tilt of +Y onto the surface normal when asked.
 *
 * @param surfaceNormal Unit world normal of the surface under the entity.
 * @param options Orientation choices.
 * @param random Random stream the yaw is drawn from.
 * @returns World orientation.
 */
export function sprinkleOrientationCompute(
  surfaceNormal: THREE.Vector3,
  options: SprinkleOrientationOptions,
  random: SprinklePrng,
): THREE.Quaternion {
  const yawAngle = options.randomYaw ? random.range(0, Math.PI * 2) : 0;
  const yaw = new THREE.Quaternion().setFromAxisAngle(SPRINKLE_ORIENTATION_UP, yawAngle);
  if (!options.alignToNormal) {
    return yaw;
  }
  const tilt = new THREE.Quaternion().setFromUnitVectors(SPRINKLE_ORIENTATION_UP, surfaceNormal.clone().normalize());
  return tilt.multiply(yaw);
}
