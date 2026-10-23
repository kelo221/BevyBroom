import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import {
  combineFaceUvRowsAboutUvPivot,
  resolveFaceUvPivot,
  type FaceUvPivotMode,
  type FaceUvRowLinearCoefficients,
} from './face_uv_operation_math.js';

/** Minimum absolute factor treated as a usable scale multiplier. */
const SCALE_FACTOR_MIN = 1e-6;

/**
 * Multiplies each axis scale by a factor, anchored on the face's UV bounds
 * center (default) or its world centroid UV so the texture does not slide
 * across the face while scaling. A non-finite or near-zero factor on an axis
 * leaves that axis unchanged.
 */
export class FaceUvOperationScale extends FaceUvOperation {
  private readonly factorU: number;
  private readonly factorV: number;
  private readonly pivotMode: FaceUvPivotMode;

  /**
   * Creates a scale operation.
   *
   * @param factorU U axis multiplier.
   * @param factorV V axis multiplier.
   * @param pivotMode Pivot the scale anchors on; defaults to the face's UV
   *   bounds center.
   */
  constructor(factorU: number, factorV: number, pivotMode: FaceUvPivotMode = 'uv-center') {
    super();
    this.factorU = factorU;
    this.factorV = factorV;
    this.pivotMode = pivotMode;
  }

  /**
   * Scales the matrix rows about the resolved pivot.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon anchoring the pivot.
   * @returns Scaled matrix.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    const coefficients: FaceUvRowLinearCoefficients = {
      a: sanitizeScaleFactor(this.factorU),
      b: 0,
      c: 0,
      d: sanitizeScaleFactor(this.factorV),
    };
    return combineFaceUvRowsAboutUvPivot(matrix, coefficients, resolveFaceUvPivot(matrix, context, this.pivotMode));
  }
}

/**
 * Sanitizes one scale factor: non-finite or near-zero factors become one so the
 * axis is left unchanged instead of collapsing.
 *
 * @param factor Requested factor.
 * @returns Usable factor.
 */
function sanitizeScaleFactor(factor: number): number {
  if (!Number.isFinite(factor) || Math.abs(factor) < SCALE_FACTOR_MIN) {
    return 1;
  }
  return factor;
}
