import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvBounds, FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import { faceUvTileBoundaryShift, shiftFaceUvRowOffset } from './face_uv_operation_math.js';

/** Face side a justify operation pulls onto the tile grid. */
export type FaceUvJustifySide = 'left' | 'right' | 'top' | 'bottom' | 'center';

/**
 * Shifts offsets only, so the face's outermost corner on one side lands exactly
 * on a tile boundary; center justification puts the face's UV center on a
 * half-tile center. Row directions and scales never change.
 */
export class FaceUvOperationJustify extends FaceUvOperation {
  private readonly side: FaceUvJustifySide;

  /**
   * Creates a justify operation.
   *
   * @param side Face side pulled onto the tile grid.
   */
  constructor(side: FaceUvJustifySide) {
    super();
    this.side = side;
  }

  /**
   * Justifies the matrix offsets for the face's UV bounds.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face polygon measured for the justification.
   * @returns Matrix with justified offsets.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    const bounds = context.uvBounds(matrix);
    if (this.side === 'left') {
      return shiftFaceUvRowOffset(matrix, 'u', faceUvTileBoundaryShift(bounds.minU, 'below'));
    }
    if (this.side === 'right') {
      return shiftFaceUvRowOffset(matrix, 'u', faceUvTileBoundaryShift(bounds.maxU, 'above'));
    }
    if (this.side === 'bottom') {
      return shiftFaceUvRowOffset(matrix, 'v', faceUvTileBoundaryShift(bounds.minV, 'below'));
    }
    if (this.side === 'top') {
      return shiftFaceUvRowOffset(matrix, 'v', faceUvTileBoundaryShift(bounds.maxV, 'above'));
    }
    return this.centerBothAxes(matrix, bounds);
  }

  /**
   * Centers both axes so the face's UV bounds center sits on a half-tile
   * center.
   *
   * @param matrix Current UV matrix (never modified).
   * @param bounds Face UV bounds under the matrix.
   * @returns Matrix with centered offsets.
   */
  private centerBothAxes(matrix: SurfaceUvMatrix, bounds: FaceUvBounds): SurfaceUvMatrix {
    const centerU = (bounds.minU + bounds.maxU) / 2;
    const centerV = (bounds.minV + bounds.maxV) / 2;
    const centeredU = shiftFaceUvRowOffset(matrix, 'u', faceUvTileBoundaryShift(centerU, 'center'));
    return shiftFaceUvRowOffset(centeredU, 'v', faceUvTileBoundaryShift(centerV, 'center'));
  }
}
