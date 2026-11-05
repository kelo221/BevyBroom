import * as THREE from 'three';
import { isResultMesh, SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { displacementFaceAttachedIs } from '@/displacement/model/displacement_face_eligibility.js';
import { displacementSurfaceMeshFind } from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/** Flat brush face a displaced result face stands for, placed in world space. */
export interface DisplacementFaceRegion {
  /** Corners of the flat brush face in winding order, world space. */
  corners: THREE.Vector3[];
  /** Unit outward normal of the flat brush face, world space. */
  normal: THREE.Vector3;
  /**
   * Displacement surface mesh shown in place of the face, or null when none is
   * built yet.
   */
  surfaceMesh: THREE.Mesh | null;
}

/**
 * Returns the flat brush face and displacement surface a solid result region
 * stands for when the region belongs to a displaced brush face.
 *
 * @param mesh Candidate solid result mesh.
 * @param triangleIndices Region triangles, all from one brush face.
 * @returns Displaced face, or null for regions of flat faces and other meshes.
 */
export function displacementFaceRegionRead(
  mesh: THREE.Mesh,
  triangleIndices: readonly number[],
): DisplacementFaceRegion | null {
  const source = displacementFaceRegionSourceRead(mesh, triangleIndices);
  const solidRoot = mesh.parent;
  const brush = source && solidRoot ? SolidModelRegistry.fromObject(mesh)?.findBrush(source.brushId) : undefined;
  if (!source || !solidRoot || !brush || !displacementFaceAttachedIs(brush, source.surfaceIndex)) {
    return null;
  }
  return displacementFaceRegionPlace(brush, source.surfaceIndex, solidRoot);
}

/**
 * Places the flat polygon of a displaced brush face in world space.
 *
 * @param brush Brush owning the face.
 * @param surfaceIndex Displaced face index.
 * @param solidRoot Solid model root owning the brush.
 * @returns Displaced face, or null when the face no longer exists.
 */
function displacementFaceRegionPlace(
  brush: SolidBrushInstance,
  surfaceIndex: number,
  solidRoot: THREE.Object3D,
): DisplacementFaceRegion | null {
  const face = brush.brush.faces[surfaceIndex];
  if (!face) {
    return null;
  }
  solidRoot.updateWorldMatrix(true, false);
  const worldMatrix = solidRoot.matrixWorld.clone().multiply(brush.getModelSpaceMatrix());
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);
  return {
    corners: brush.brush.getFaceVertices(face).map((corner) => corner.clone().applyMatrix4(worldMatrix)),
    normal: brush.faceNormalLocal(surfaceIndex).clone().applyMatrix3(normalMatrix).normalize(),
    surfaceMesh: displacementSurfaceMeshFind(solidRoot, brush.id, surfaceIndex),
  };
}

/**
 * Reads the brush face source of the first region triangle on a result mesh.
 *
 * @param mesh Candidate solid result mesh.
 * @param triangleIndices Region triangles.
 * @returns Brush face source, or null.
 */
function displacementFaceRegionSourceRead(
  mesh: THREE.Mesh,
  triangleIndices: readonly number[],
): SolidTriangleSourceRef | null {
  const firstTriangle = triangleIndices[0];
  if (firstTriangle === undefined || !isResultMesh(mesh)) {
    return null;
  }
  const sources = mesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as
    Array<SolidTriangleSourceRef | undefined> | undefined;
  const source = sources?.[firstTriangle];
  return source?.brushId ? source : null;
}
