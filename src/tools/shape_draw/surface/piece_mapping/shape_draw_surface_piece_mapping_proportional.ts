import { ShapeDrawSurfacePieceMapping } from './shape_draw_surface_piece_mapping.js';

/**
 * Maps each new piece to the old piece covering the same fraction of the piece
 * order, so pieces swept around an axis inherit from the old piece at the same
 * angle.
 */
export class ShapeDrawSurfacePieceMappingProportional extends ShapeDrawSurfacePieceMapping {
  /**
   * Picks the old piece whose share of the order contains the new piece's
   * middle.
   *
   * @param pieceIndex New piece index.
   * @param pieceCount Number of new pieces.
   * @param sourceCount Number of old pieces, at least one.
   * @returns Old piece index.
   */
  protected sourceIndexPick(pieceIndex: number, pieceCount: number, sourceCount: number): number {
    const pieceMiddleFraction = (pieceIndex + 0.5) / Math.max(pieceCount, 1);
    return Math.floor(pieceMiddleFraction * sourceCount);
  }
}
