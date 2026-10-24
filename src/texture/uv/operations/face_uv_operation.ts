import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';

/**
 * Pure transform of one face's UV matrix. Implementations never modify the
 * input matrix or the context; they return a new matrix built from the
 * operation's parameters.
 */
export abstract class FaceUvOperation {
  /**
   * Produces the transformed UV matrix for one face.
   *
   * @param matrix Current UV matrix of the face (never modified).
   * @param context World-space description of the face polygon.
   * @returns New UV matrix after the operation.
   */
  abstract apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix;
}
