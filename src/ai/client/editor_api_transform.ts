import * as THREE from 'three';
import { entityScaleUnitEnsure } from '@/entity/scale/entity_scale_absorb.js';
import { entityTransformScaleAllowed } from '@/entity/scale/entity_scale_allowed.js';

/** Optional transform arguments of tools that add objects. */
export interface EditorApiTransformArgs {
  position?: { x: number; y: number; z: number };
  rotationDegrees?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

/**
 * Places an object at the requested position, rotation and scale. Objects that
 * may not be scaled, such as lights and game entities, ignore the scale, and
 * objects that turn scale into settings keep a unit scale.
 *
 * @param object Object to place.
 * @param args Transform arguments; missing parts keep the object's values.
 */
export function editorApiTransformApply(object: THREE.Object3D, args: EditorApiTransformArgs): void {
  if (args.position) {
    object.position.set(args.position.x, args.position.y, args.position.z);
  }
  if (args.rotationDegrees) {
    editorApiTransformRotationApply(object, args.rotationDegrees);
  }
  if (args.scale && entityTransformScaleAllowed(object)) {
    object.scale.set(args.scale.x, args.scale.y, args.scale.z);
  }
  entityScaleUnitEnsure(object);
  object.updateMatrixWorld(true);
}

/**
 * Sets an object's rotation from Euler angles in degrees.
 *
 * @param object Object to rotate.
 * @param rotationDegrees Euler angles in degrees, XYZ order.
 * @param rotationDegrees.x Rotation about X in degrees.
 * @param rotationDegrees.y Rotation about Y in degrees.
 * @param rotationDegrees.z Rotation about Z in degrees.
 */
function editorApiTransformRotationApply(
  object: THREE.Object3D,
  rotationDegrees: { x: number; y: number; z: number },
): void {
  const radians = THREE.MathUtils.degToRad;
  object.rotation.set(radians(rotationDegrees.x), radians(rotationDegrees.y), radians(rotationDegrees.z));
}
