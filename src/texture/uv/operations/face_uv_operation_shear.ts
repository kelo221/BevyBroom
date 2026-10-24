import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import { combineFaceUvRowsAboutUvPivot, type FaceUvRowLinearCoefficients } from './face_uv_operation_math.js';

/** Which texture coordinate is sheared by the other. */
export type FaceUvShearMode = 'u-by-v' | 'v-by-u';

/**
 * Shears the texture inside its own frame: u' = u + factor·v or v' = v +
 * factor·u. Both row directions stay in the projection plane, so the plane
 * normal and scale magnitudes are preserved.
 */
export class FaceUvOperationShear extends FaceUvOperation {
  private readonly mode: FaceUvShearMode;
  private readonly factor: number;

  /**
   * Creates a shear operation.
   *
   * @param mode Which coordinate shears.
   * @param factor Shear factor; the matching negative factor inverts it.
   */
  constructor(mode: FaceUvShearMode, factor: number) {
    super();
    this.mode = mode;
    this.factor = factor;
  }

  /**
   * Shears the matrix rows in the texture frame.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon (unused; shear is face-independent).
   * @returns Sheared matrix, or the input for a non-finite factor.
   */
  apply(matrix: SurfaceUvMatrix, _context: FaceUvOperationContext): SurfaceUvMatrix {
    if (!Number.isFinite(this.factor)) {
      return matrix;
    }
    const coefficients: FaceUvRowLinearCoefficients =
      this.mode === 'u-by-v' ? { a: 1, b: this.factor, c: 0, d: 1 } : { a: 1, b: 0, c: this.factor, d: 1 };
    return combineFaceUvRowsAboutUvPivot(matrix, coefficients, { u: 0, v: 0 });
  }
}
