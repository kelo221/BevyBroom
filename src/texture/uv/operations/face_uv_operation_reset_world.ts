import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { resolveProjectionNormal } from '../planar_uv_projector.js';
import type { FaceTextureAlign } from '../face_texture_mapping.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';

/**
 * Rebuilds the UV matrix on a world-axis-snapped projection plane: floors and
 * ceilings project along world Y, other faces along their dominant horizontal
 * world axis. Unit scale, zero rotation, zero offset.
 */
export class FaceUvOperationResetWorld extends FaceUvOperation {
  /**
   * Rebuilds the matrix on the snapped world projection plane.
   *
   * @param matrix Current UV matrix (never modified; replaced wholesale).
   * @param context Face context providing the face normal.
   * @returns Reset matrix.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    void matrix;
    const projectionNormal = resolveProjectionNormal(context.faceNormal, resolveWorldSnappedAlign(context.faceNormal));
    return SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), projectionNormal, 0, 1, 1);
  }
}

/**
 * Picks the world-axis align preset whose projection normal is the dominant
 * axis of a face normal.
 *
 * @param faceNormal Unit face normal.
 * @returns Floor, ceiling, or wall align preset.
 */
function resolveWorldSnappedAlign(faceNormal: THREE.Vector3): FaceTextureAlign {
  const absX = Math.abs(faceNormal.x);
  const absY = Math.abs(faceNormal.y);
  const absZ = Math.abs(faceNormal.z);
  if (absY >= absX && absY >= absZ) {
    return faceNormal.y >= 0 ? 'floor' : 'ceiling';
  }
  return 'wall';
}
