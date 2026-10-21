import * as THREE from 'three';
import { entityScaleUnitEnsure } from '@/entity/scale/entity_scale_absorb.js';

/** Optional transform arguments of tools that add objects. */
export interface EditorApiTransformArgs {
  position?: { x: number; y: number; z: number };
  rotationDegrees?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

/**
 * Places an object at the requested position, rotation and scale. Objects that
 * turn scale into settings, such as lights, keep a unit scale.
 *
 * @param object Object to place.
 * @param args Transform arguments; missing parts keep the object's values.
 */
export function editorApiTransformApply(object: THREE.Object3D, args: EditorApiTransformArgs): void {
  if (args.position) {
    object.position.set(args.position.x, args.position.y, args.position.z);
  }
  if (args.rotationDegrees) {
    const radians = THREE.MathUtils.degToRad;
    object.rotation.set(
      radians(args.rotationDegrees.x),
      radians(args.rotationDegrees.y),
      radians(args.rotationDegrees.z),
    );
  }
  if (args.scale) {
    object.scale.set(args.scale.x, args.scale.y, args.scale.z);
  }
  entityScaleUnitEnsure(object);
  object.updateMatrixWorld(true);
}
