import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import {
  combineFaceUvRowsAboutUvPivot,
  faceUvFitScaleFactor,
  faceUvTileBoundaryShift,
  sanitizeFaceUvRepeatCount,
  shiftFaceUvRowOffset,
  type FaceUvRowLinearCoefficients,
} from './face_uv_operation_math.js';

/** Axes a fit operation can rescale. */
export type FaceUvFitAxis = 'u' | 'v' | 'both';

/** Options accepted when constructing a fit operation. */
export interface FaceUvOperationFitOptions {
  /** Which axes to fit; defaults to both. */
  axis?: FaceUvFitAxis;
  /** Whole texture repeats that must span the face; defaults to one. */
  repeatCount?: number;
}

/** Linear identity map used as the base when scaling single axes. */
const IDENTITY_COEFFICIENTS: FaceUvRowLinearCoefficients = { a: 1, b: 0, c: 0, d: 1 };

/**
 * Scales the texture so a whole number of repeats spans the face along the
 * chosen axes, keeps each axis's mirror sign, and lands the face's minimum UV
 * corner on a tile boundary.
 */
export class FaceUvOperationFit extends FaceUvOperation {
  private readonly axis: FaceUvFitAxis;
  private readonly repeatCount: number;

  /**
   * Creates a fit operation.
   *
   * @param options Fit axis and repeat count.
   */
  constructor(options: FaceUvOperationFitOptions = {}) {
    super();
    this.axis = options.axis ?? 'both';
    this.repeatCount = sanitizeFaceUvRepeatCount(options.repeatCount ?? 1);
  }

  /**
   * Fits the matrix's U and/or V scale to the face's UV extent.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon measured for the fit.
   * @returns Fitted matrix, or the input itself when a fitted extent is
   *   degenerate.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    if (this.axis === 'v') {
      return this.axisFit(matrix, context, 'v');
    }
    const fittedU = this.axisFit(matrix, context, 'u');
    if (this.axis === 'u') {
      return fittedU;
    }
    return this.axisFit(fittedU, context, 'v');
  }

  /**
   * Fits one axis of a matrix to the face's extent along it.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon measured for the fit.
   * @param axis Axis to fit.
   * @returns Matrix with the axis fitted, or the input when degenerate.
   */
  private axisFit(matrix: SurfaceUvMatrix, context: FaceUvOperationContext, axis: 'u' | 'v'): SurfaceUvMatrix {
    const bounds = context.uvBounds(matrix);
    const extent = axis === 'u' ? bounds.maxU - bounds.minU : bounds.maxV - bounds.minV;
    const factor = faceUvFitScaleFactor(extent, this.repeatCount);
    if (factor === null) {
      return matrix;
    }
    const scaled = this.axisScale(matrix, axis, factor);
    return this.axisAnchorMinCorner(scaled, context, axis);
  }

  /**
   * Multiplies one axis scale of a matrix, leaving the other axis untouched.
   *
   * @param matrix Source matrix.
   * @param axis Axis to scale.
   * @param factor Positive scale factor (direction sign preserved).
   * @returns Scaled matrix.
   */
  private axisScale(matrix: SurfaceUvMatrix, axis: 'u' | 'v', factor: number): SurfaceUvMatrix {
    const coefficients: FaceUvRowLinearCoefficients =
      axis === 'u' ? { ...IDENTITY_COEFFICIENTS, a: factor } : { ...IDENTITY_COEFFICIENTS, d: factor };
    return combineFaceUvRowsAboutUvPivot(matrix, coefficients, { u: 0, v: 0 });
  }

  /**
   * Shifts one axis offset so the face's minimum UV corner on that axis sits
   * exactly on a tile boundary.
   *
   * @param matrix Fitted matrix.
   * @param context Face polygon measured for the anchor.
   * @param axis Axis to anchor.
   * @returns Matrix with the anchored offset.
   */
  private axisAnchorMinCorner(
    matrix: SurfaceUvMatrix,
    context: FaceUvOperationContext,
    axis: 'u' | 'v',
  ): SurfaceUvMatrix {
    const bounds = context.uvBounds(matrix);
    const minValue = axis === 'u' ? bounds.minU : bounds.minV;
    return shiftFaceUvRowOffset(matrix, axis, faceUvTileBoundaryShift(minValue, 'below'));
  }
}
