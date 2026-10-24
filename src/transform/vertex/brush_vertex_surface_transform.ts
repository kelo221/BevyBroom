import * as THREE from 'three';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { FaceSurfaceDescription, cloneFaceSurface } from '@/texture/uv_matrix/face_surface_description.js';

/**
 * Rewrites one face surface UV matrix so the same material point projects to
 * the same UV after the brush vertices were transformed by a matrix.
 *
 * @param surface Surface authored for the pre-transform vertices.
 * @param vertexMatrix Matrix that maps old brush-local vertices to new ones.
 * @returns Surface with UV rows transformed by the inverse transpose.
 */
export function brushVertexSurfaceTransform(
  surface: FaceSurfaceDescription,
  vertexMatrix: THREE.Matrix4,
): FaceSurfaceDescription {
  const result = cloneFaceSurface(surface);
  result.uv = result.uv.clone();
  brushVertexRowTransform(result.uv.u, vertexMatrix);
  brushVertexRowTransform(result.uv.v, vertexMatrix);
  return result;
}

/**
 * Transforms one homogeneous UV row by the inverse of the vertex matrix.
 *
 * @param row UV row (mutated in place).
 * @param vertexMatrix Matrix that maps old brush-local vertices to new ones.
 */
function brushVertexRowTransform(row: THREE.Vector4, vertexMatrix: THREE.Matrix4): void {
  const inverseTranspose = vertexMatrix.clone().invert().transpose();
  const transformed = row.clone().applyMatrix4(inverseTranspose);
  row.set(transformed.x, transformed.y, transformed.z, transformed.w);
}

/**
 * Applies the covector UV transform to every face of a brush instance.
 *
 * @param instance Brush instance holding the transformed geometry.
 * @param vertexMatrix Matrix that mapped old brush-local vertices to new ones.
 */
export function brushVertexSurfacesTransformAll(instance: SolidBrushInstance, vertexMatrix: THREE.Matrix4): void {
  const faceCount = instance.brush.faces.length;
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    instance.setFaceSurface(faceIndex, brushVertexSurfaceTransform(instance.getFaceSurface(faceIndex), vertexMatrix));
  }
}
