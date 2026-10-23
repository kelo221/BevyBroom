import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import {
  combineFaceUvRowsAboutUvPivot,
  isFaceUvVAxisMoreCameraRightAligned,
  type FaceUvRowLinearCoefficients,
} from './face_uv_operation_math.js';

/** Screen axis a flip mirrors along. */
export type FaceUvFlipAxis = 'horizontal' | 'vertical';

/**
 * Mirrors the texture along one screen axis: horizontal negates the U row,
 * vertical negates the V row. When camera directions are supplied and the V
 * axis is the more camera-horizontal one (texture seen sideways), the flipped
 * axis swaps. The flip anchors on the face's UV bounds center so the face stays
 * inside its texture region.
 */
export class FaceUvOperationFlip extends FaceUvOperation {
  private readonly flipAxis: FaceUvFlipAxis;

  /**
   * Creates a flip operation.
   *
   * @param flipAxis Screen axis to mirror along.
   */
  constructor(flipAxis: FaceUvFlipAxis) {
    super();
    this.flipAxis = flipAxis;
  }

  /**
   * Flips the matrix about the face's UV bounds center.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon anchoring the flip center.
   * @returns Flipped matrix.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    const targetAxis = this.resolveTargetAxis(matrix, context);
    const coefficients: FaceUvRowLinearCoefficients =
      targetAxis === 'u' ? { a: -1, b: 0, c: 0, d: 1 } : { a: 1, b: 0, c: 0, d: -1 };
    return combineFaceUvRowsAboutUvPivot(matrix, coefficients, context.uvBoundsCenter(matrix));
  }

  /**
   * Resolves which texture row the flip negates, accounting for a sideways
   * texture when camera directions are available.
   *
   * @param matrix Current UV matrix.
   * @param context Context that may carry camera directions.
   * @returns Row axis to negate.
   */
  private resolveTargetAxis(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): 'u' | 'v' {
    const cameraRight = context.cameraRight;
    const sideways = cameraRight ? isFaceUvVAxisMoreCameraRightAligned(matrix, cameraRight) : false;
    if (this.flipAxis === 'horizontal') {
      return sideways ? 'v' : 'u';
    }
    return sideways ? 'u' : 'v';
  }
}
