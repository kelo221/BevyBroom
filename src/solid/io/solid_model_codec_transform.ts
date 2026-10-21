import * as THREE from 'three';

/** Plain xyz components as stored in serialized solid data. */
export interface SolidSerializedVector {
  x: number;
  y: number;
  z: number;
}

/** Position, XYZ Euler rotation and scale of a serialized brush or group. */
export interface SolidSerializedTransform {
  position: SolidSerializedVector;
  rotation: SolidSerializedVector;
  scale: SolidSerializedVector;
}

/**
 * Composes the matrix of a serialized transform.
 *
 * @param transform Serialized position, rotation and scale.
 * @returns Matrix applying scale, then rotation, then translation.
 */
export function solidSerializedTransformMatrixCompose(transform: SolidSerializedTransform): THREE.Matrix4 {
  const position = new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z);
  const rotation = new THREE.Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z, 'XYZ');
  const scale = new THREE.Vector3(transform.scale.x, transform.scale.y, transform.scale.z);
  return new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
}

/**
 * Overwrites a serialized transform with the decomposition of a matrix.
 *
 * @param transform Serialized transform to overwrite.
 * @param matrix Matrix to decompose; shear is dropped.
 */
export function solidSerializedTransformAssignFromMatrix(
  transform: SolidSerializedTransform,
  matrix: THREE.Matrix4,
): void {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  transform.position = { x: position.x, y: position.y, z: position.z };
  transform.rotation = { x: rotation.x, y: rotation.y, z: rotation.z };
  transform.scale = { x: scale.x, y: scale.y, z: scale.z };
}

/**
 * Re-expresses a serialized transform in another space by multiplying a space
 * change matrix in front of it.
 *
 * @param transform Serialized transform to overwrite.
 * @param spaceChange Matrix mapping the current space to the new space.
 */
export function solidSerializedTransformSpaceChange(
  transform: SolidSerializedTransform,
  spaceChange: THREE.Matrix4,
): void {
  const changed = spaceChange.clone().multiply(solidSerializedTransformMatrixCompose(transform));
  solidSerializedTransformAssignFromMatrix(transform, changed);
}
