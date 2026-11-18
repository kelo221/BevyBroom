import * as THREE from 'three';
import { materialIdentityWrite } from '@/materials/identity/material_identity.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';

/** Where an Add > Box test mesh sits and what it looks like. */
export interface CollisionTestBoxMeshPose {
  readonly size: THREE.Vector3;
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Euler;
  readonly texture?: string;
}

/**
 * Creates a box mesh the way Add > Box does, places it and stamps its material
 * with a texture.
 *
 * @param pose Size, position, rotation and optional texture.
 * @returns Box mesh with a current world matrix.
 */
export function collisionTestBoxMeshCreate(pose: CollisionTestBoxMeshPose): THREE.Mesh {
  const mesh = new ToolPrimitiveCreation(new THREE.Group()).createBox(pose.size.x, pose.size.y, pose.size.z);
  mesh.position.copy(pose.position);
  mesh.rotation.copy(pose.rotation);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (pose.texture !== undefined) {
    const texture = pose.texture;
    materials.forEach((material) => materialIdentityWrite(material, texture));
  }
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Returns the eight world corners of a placed box mesh, computed from its size
 * and world matrix.
 *
 * @param mesh Box mesh with a current world matrix.
 * @param size Box size.
 * @returns World corners.
 */
export function collisionTestBoxCornersWorld(mesh: THREE.Object3D, size: THREE.Vector3): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        corners.push(new THREE.Vector3(x * size.x, y * size.y, z * size.z).applyMatrix4(mesh.matrixWorld));
      }
    }
  }
  return corners;
}
