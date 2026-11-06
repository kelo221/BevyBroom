import type * as THREE from 'three';
import { isResultMesh } from '@/solid/model/solid_model_keys.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import {
  displacementSurfaceMeshIdentityRead,
  displacementSurfaceMeshesUnder,
} from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/**
 * Lists the displacement surface meshes shown next to a solid result mesh.
 *
 * @param resultMesh Candidate solid result mesh.
 * @returns Displacement surface meshes of the same solid model, empty for other
 *   meshes.
 */
export function displacementSurfaceMeshesBesideResult(resultMesh: THREE.Mesh): THREE.Mesh[] {
  const solidRoot = resultMesh.parent;
  if (!solidRoot || !isResultMesh(resultMesh)) {
    return [];
  }
  return displacementSurfaceMeshesUnder(solidRoot);
}

/**
 * Maps a displacement surface mesh to a result triangle of the brush face it
 * replaces, so picks on the surface select that brush face.
 *
 * @param resultMesh Solid result mesh of the same model.
 * @param surfaceMesh Displacement surface mesh.
 * @returns Result triangle index, or -1 when the face has no result triangle.
 */
export function displacementResultTriangleRead(resultMesh: THREE.Mesh, surfaceMesh: THREE.Object3D): number {
  const identity = displacementSurfaceMeshIdentityRead(surfaceMesh);
  if (!identity) {
    return -1;
  }
  return findFirstTriangleForBrushSurface(resultMesh, identity.brushId, identity.surfaceIndex);
}
