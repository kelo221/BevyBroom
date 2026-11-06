import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { surfaceUvFullTileShift } from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';
import { FaceUvOperation } from './face_uv_operation.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';

/**
 * Shifts a face's UV translation by whole-tile increments (`±1.0` per tile)
 * along U and/or V.
 */
export class FaceUvOperationFullTileShift extends FaceUvOperation {
  private readonly tilesU: number;
  private readonly tilesV: number;

  /**
   * Creates a full-tile UV shift operation.
   *
   * @param tilesU Whole-tile delta along U.
   * @param tilesV Whole-tile delta along V.
   */
  constructor(tilesU: number, tilesV: number) {
    super();
    this.tilesU = tilesU;
    this.tilesV = tilesV;
  }

  /**
   * Produces a UV matrix shifted by `(tilesU, tilesV)` full tiles.
   *
   * @param matrix Current UV matrix.
   * @param _context Face operation context.
   * @returns Shifted UV matrix.
   */
  override apply(matrix: SurfaceUvMatrix, _context: FaceUvOperationContext): SurfaceUvMatrix {
    return surfaceUvFullTileShift(matrix, this.tilesU, this.tilesV);
  }
}
