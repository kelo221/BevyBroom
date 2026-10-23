import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';

/**
 * Rebuilds the UV matrix projected onto the face's own plane: stable basis for
 * the actual face normal, unit scale, zero rotation, zero offset.
 */
export class FaceUvOperationResetFace extends FaceUvOperation {
  /**
   * Rebuilds the matrix on the face plane.
   *
   * @param matrix Current UV matrix (never modified; replaced wholesale).
   * @param context Face context providing the face normal.
   * @returns Reset matrix.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    void matrix;
    return SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), context.faceNormal, 0, 1, 1);
  }
}
