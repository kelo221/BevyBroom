import * as THREE from 'three';
import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import {
  combineFaceUvRowsAboutUvPivot,
  faceUvExactQuarterTurnCosSin,
  resolveFaceUvPivot,
  type FaceUvPivotMode,
  type FaceUvRowLinearCoefficients,
} from './face_uv_operation_math.js';

/**
 * Rotates the texture in the face plane by whole degrees about the face's UV
 * bounds center or its world centroid UV. Quarter turns (±90 and multiples) use
 * exact unit values so four quarter turns restore the input exactly.
 */
export class FaceUvOperationRotate extends FaceUvOperation {
  private readonly degrees: number;
  private readonly pivotMode: FaceUvPivotMode;

  /**
   * Creates a rotate operation.
   *
   * @param degrees Rotation angle in degrees; positive matches the
   *   SurfaceUvMatrix.fromTrs rotation direction.
   * @param pivotMode Pivot the rotation anchors on; defaults to the face's UV
   *   bounds center.
   */
  constructor(degrees: number, pivotMode: FaceUvPivotMode = 'uv-center') {
    super();
    this.degrees = degrees;
    this.pivotMode = pivotMode;
  }

  /**
   * Rotates the matrix rows about the resolved pivot.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon anchoring the pivot.
   * @returns Rotated matrix, or the input for a non-finite angle.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    if (!Number.isFinite(this.degrees)) {
      return matrix;
    }
    const rotation = this.resolveRotationValues();
    const coefficients: FaceUvRowLinearCoefficients = {
      a: rotation.cosine,
      b: rotation.sine,
      c: -rotation.sine,
      d: rotation.cosine,
    };
    return combineFaceUvRowsAboutUvPivot(matrix, coefficients, resolveFaceUvPivot(matrix, context, this.pivotMode));
  }

  /**
   * Resolves the rotation unit values, snapping whole quarter turns to exact
   * values.
   *
   * @returns Cosine and sine of the rotation angle.
   */
  private resolveRotationValues(): { cosine: number; sine: number } {
    const exactQuarter = faceUvExactQuarterTurnCosSin(this.degrees);
    if (exactQuarter) {
      return exactQuarter;
    }
    const radians = THREE.MathUtils.degToRad(this.degrees);
    return { cosine: Math.cos(radians), sine: Math.sin(radians) };
  }
}
