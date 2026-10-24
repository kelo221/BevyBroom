import * as THREE from 'three';

/** World axis a flip mirrors across. */
export type FlipAxis = 'x' | 'y' | 'z';

/** Horizontal world axis a flip can mirror across. */
export type FlipHorizontalAxis = Exclude<FlipAxis, 'y'>;

/**
 * Builds a world-space mirror matrix across a plane through a center.
 *
 * @param axis World axis the mirror plane is perpendicular to.
 * @param center Plane coordinate along that axis.
 * @returns Mirror matrix (determinant -1).
 */
export function flipMirrorMatrixBuild(axis: FlipAxis, center: number): THREE.Matrix4 {
  const scale = flipMirrorScale(axis);
  const translation = flipMirrorTranslation(axis, center);
  return new THREE.Matrix4().compose(translation, new THREE.Quaternion(), scale);
}

/**
 * Builds the reflection scale of one axis.
 *
 * @param axis World axis the mirror plane is perpendicular to.
 * @returns Scale that negates the mirrored axis.
 */
function flipMirrorScale(axis: FlipAxis): THREE.Vector3 {
  const scale = new THREE.Vector3(1, 1, 1);
  if (axis === 'x') {
    scale.x = -1;
  } else if (axis === 'y') {
    scale.y = -1;
  } else {
    scale.z = -1;
  }
  return scale;
}

/**
 * Builds the translation that keeps the mirror plane fixed.
 *
 * @param axis World axis the mirror plane is perpendicular to.
 * @param center Plane coordinate along that axis.
 * @returns Translation of twice the center on the mirrored axis.
 */
function flipMirrorTranslation(axis: FlipAxis, center: number): THREE.Vector3 {
  const translation = new THREE.Vector3();
  if (axis === 'x') {
    translation.x = center * 2;
  } else if (axis === 'y') {
    translation.y = center * 2;
  } else {
    translation.z = center * 2;
  }
  return translation;
}

/**
 * Returns the horizontal world axis (X or Z) closest to a camera right vector.
 *
 * @param cameraRight Camera right direction in world space.
 * @returns 'x' or 'z', whichever the camera right points along more.
 */
export function flipHorizontalAxisForCamera(cameraRight: THREE.Vector3): FlipHorizontalAxis {
  return Math.abs(cameraRight.x) >= Math.abs(cameraRight.z) ? 'x' : 'z';
}

/**
 * Reads the world right direction of a camera.
 *
 * @param camera Active viewport camera.
 * @returns Camera right vector.
 */
export function flipCameraRightRead(camera: THREE.Camera): THREE.Vector3 {
  camera.updateMatrixWorld();
  return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
}
