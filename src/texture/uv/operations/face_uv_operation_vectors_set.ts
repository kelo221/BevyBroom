import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { surfaceUvVectors2x3Write, type SurfaceUvVectors2x3 } from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';
import { FaceUvOperation } from './face_uv_operation.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';

/**
 * Replaces the 2×3 U and V projection axis direction vectors of a face's UV
 * matrix while preserving its U/V scale magnitudes and translation offsets.
 */
export class FaceUvOperationVectorsSet extends FaceUvOperation {
  private readonly vectors: SurfaceUvVectors2x3;

  /**
   * Creates a 2×3 UV axis vector assignment operation.
   *
   * @param vectors Target U and V direction vectors.
   */
  constructor(vectors: SurfaceUvVectors2x3) {
    super();
    this.vectors = vectors;
  }

  /**
   * Produces a UV matrix with updated U and V axis directions.
   *
   * @param matrix Current UV matrix.
   * @param _context Face operation context.
   * @returns Updated UV matrix.
   */
  override apply(matrix: SurfaceUvMatrix, _context: FaceUvOperationContext): SurfaceUvMatrix {
    return surfaceUvVectors2x3Write(matrix, this.vectors);
  }
}
