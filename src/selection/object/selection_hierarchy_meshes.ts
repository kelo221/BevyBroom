import type * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { collectMeshesUnder } from '@/utils/utils_hierarchy.js';

/**
 * Collects the meshes that represent hierarchy objects in the selection. Solid
 * model roots contribute their result mesh only, so the solid transforms as a
 * unit; other objects contribute every mesh under them except solid results.
 *
 * @param hierarchyObjects Objects selected as hierarchy entries.
 * @returns Distinct meshes for the selection manager.
 */
export function selectionMeshesFromHierarchyCollect(hierarchyObjects: Iterable<THREE.Object3D>): THREE.Mesh[] {
  const meshes = new Set<THREE.Mesh>();
  for (const object of hierarchyObjects) {
    if (SolidModel.isSolidModelObject(object)) {
      selectionSolidModelProxyAppend(object, meshes);
      continue;
    }
    collectMeshesUnder(object).forEach((mesh) => {
      if (!SolidModel.isResultMesh(mesh)) {
        meshes.add(mesh);
      }
    });
  }
  return [...meshes];
}

/**
 * Adds the result mesh of a solid model as its selection proxy.
 *
 * @param solidRoot Solid model root group.
 * @param meshes Mesh accumulator.
 */
function selectionSolidModelProxyAppend(solidRoot: THREE.Object3D, meshes: Set<THREE.Mesh>): void {
  const resultMesh = SolidModel.fromObject(solidRoot)?.getResultMesh();
  if (resultMesh) {
    meshes.add(resultMesh);
  }
}
