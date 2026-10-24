import * as THREE from 'three';
import type { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';

/**
 * Applies a model-local pose to a prepared brush instance, converting into the
 * hierarchy parent's local space when the brush lives under a nested solid CSG
 * group.
 *
 * @param model Solid model the brush belongs to.
 * @param hierarchyParent Solid root or solid CSG group the brush goes under.
 * @param instance Prepared brush instance with a mesh attached.
 * @param modelLocalPosition Position in model space.
 * @param modelLocalRotation Rotation in model space.
 */
export function solidBrushModelPoseApply(
  model: SolidModel,
  hierarchyParent: THREE.Object3D,
  instance: SolidBrushInstance,
  modelLocalPosition: THREE.Vector3,
  modelLocalRotation: THREE.Euler,
): void {
  const mesh = instance.mesh;
  if (!mesh) {
    instance.position.copy(modelLocalPosition);
    instance.rotation.copy(modelLocalRotation);
    return;
  }
  instance.position.copy(modelLocalPosition);
  instance.rotation.copy(modelLocalRotation);
  if (hierarchyParent === model.root) {
    instance.pushTransformToMesh();
    return;
  }
  solidBrushNestedPoseWrite(model, hierarchyParent, mesh, instance);
}

/**
 * Writes the mesh pose so the model-local pose becomes parent-local under a
 * nested solid CSG group.
 *
 * @param model Solid model the brush belongs to.
 * @param hierarchyParent Nested solid CSG group.
 * @param mesh Brush preview mesh.
 * @param instance Brush instance synced from the mesh afterwards.
 */
function solidBrushNestedPoseWrite(
  model: SolidModel,
  hierarchyParent: THREE.Object3D,
  mesh: THREE.Mesh,
  instance: SolidBrushInstance,
): void {
  model.root.updateWorldMatrix(true, false);
  hierarchyParent.updateWorldMatrix(true, false);
  const worldPosition = instance.position.clone().applyMatrix4(model.root.matrixWorld);
  mesh.position.copy(hierarchyParent.worldToLocal(worldPosition));
  mesh.quaternion.copy(solidBrushNestedQuaternionCreate(model, hierarchyParent, instance));
  instance.pullTransformFromMesh();
}

/**
 * Builds the parent-local rotation of a model-local brush rotation.
 *
 * @param model Solid model the brush belongs to.
 * @param hierarchyParent Nested solid CSG group.
 * @param instance Brush instance holding the model-local rotation.
 * @returns Parent-local quaternion.
 */
function solidBrushNestedQuaternionCreate(
  model: SolidModel,
  hierarchyParent: THREE.Object3D,
  instance: SolidBrushInstance,
): THREE.Quaternion {
  const modelLocalQuaternion = new THREE.Quaternion().setFromEuler(instance.rotation);
  const rootWorldQuaternion = model.root.getWorldQuaternion(new THREE.Quaternion());
  const parentWorldQuaternion = hierarchyParent.getWorldQuaternion(new THREE.Quaternion());
  const worldQuaternion = rootWorldQuaternion.clone().multiply(modelLocalQuaternion);
  return parentWorldQuaternion.invert().multiply(worldQuaternion);
}
