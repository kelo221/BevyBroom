import * as THREE from 'three';

/**
 * Returns an end at an angle above a start, along a turned horizontal
 * direction.
 *
 * @param start Start point.
 * @param angleDegrees Angle above the horizontal.
 * @param length Distance between the ends.
 * @returns End point.
 */
export function endAtAngle(start: THREE.Vector3, angleDegrees: number, length: number): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(angleDegrees);
  const horizontal = new THREE.Vector3(3, 0, -4).normalize().multiplyScalar(Math.cos(angle) * length);
  return start
    .clone()
    .add(horizontal)
    .add(new THREE.Vector3(0, Math.sin(angle) * length, 0));
}
