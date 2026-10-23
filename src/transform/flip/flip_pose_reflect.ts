import * as THREE from 'three';
import type { FlipAxis } from '@/transform/flip/flip_axis.js';

/** Pose of one object before and after a mirror. */
export interface FlipPoseReflection {
  /** Mirrored position. */
  position: THREE.Vector3;
  /** Mirrored Euler rotation (yaw reflected). */
  rotation: THREE.Euler;
}

/**
 * Reflects an object pose across a constant world X or Z plane.
 *
 * @param position Position to reflect.
 * @param rotation Rotation whose yaw is reflected.
 * @param axis Mirror axis ('x' or 'z').
 * @param plane Plane coordinate on that axis.
 * @returns Reflected pose.
 */
export function flipPoseReflect(
  position: THREE.Vector3,
  rotation: THREE.Euler,
  axis: Exclude<FlipAxis, 'y'>,
  plane: number,
): FlipPoseReflection {
  const nextPosition = position.clone();
  const nextRotation = rotation.clone();
  if (axis === 'x') {
    nextPosition.x = plane * 2 - nextPosition.x;
    nextRotation.y = -nextRotation.y;
  } else {
    nextPosition.z = plane * 2 - nextPosition.z;
    nextRotation.y = Math.PI - nextRotation.y;
  }
  return { position: nextPosition, rotation: nextRotation };
}
