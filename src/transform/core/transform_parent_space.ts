import * as THREE from 'three';

/** Scratch matrix holding the inverse world matrix of a parent. */
const TRANSFORM_PARENT_SPACE_PARENT_INVERSE = new THREE.Matrix4();

/** Scratch matrix holding the linear part of a parent's inverse world matrix. */
const TRANSFORM_PARENT_SPACE_PARENT_INVERSE_LINEAR = new THREE.Matrix3();

/**
 * Converts world-space movement into the local space an object's position is
 * stored in.
 */
export class TransformParentSpace {
  /**
   * Returns a world-space offset expressed in the space of the object's parent,
   * so adding it to the object's local position moves the object by that offset
   * in the world. Objects without a parent get an unchanged copy.
   *
   * @param object Object whose local position the offset will be added to.
   * @param worldOffset Movement in world space; left unchanged.
   * @returns New vector holding the offset in the parent's space.
   */
  static worldOffsetToParentLocal(object: THREE.Object3D, worldOffset: THREE.Vector3): THREE.Vector3 {
    const parent = object.parent;
    if (!parent) {
      return worldOffset.clone();
    }
    parent.updateWorldMatrix(true, false);
    TRANSFORM_PARENT_SPACE_PARENT_INVERSE.copy(parent.matrixWorld).invert();
    TRANSFORM_PARENT_SPACE_PARENT_INVERSE_LINEAR.setFromMatrix4(TRANSFORM_PARENT_SPACE_PARENT_INVERSE);
    return worldOffset.clone().applyMatrix3(TRANSFORM_PARENT_SPACE_PARENT_INVERSE_LINEAR);
  }
}
