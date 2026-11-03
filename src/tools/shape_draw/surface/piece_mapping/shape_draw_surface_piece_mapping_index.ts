import { ShapeDrawSurfacePieceMapping } from './shape_draw_surface_piece_mapping.js';

/**
 * Maps new pieces to old pieces by position in the order: the last new piece
 * takes the last old piece, every other piece takes the same index, and pieces
 * beyond the old range take the last old piece.
 */
export class ShapeDrawSurfacePieceMappingIndex extends ShapeDrawSurfacePieceMapping {
  /**
   * Picks the last old piece for the last or an added new piece, else the same
   * index.
   *
   * @param pieceIndex New piece index.
   * @param pieceCount Number of new pieces.
   * @param sourceCount Number of old pieces, at least one.
   * @returns Old piece index.
   */
  protected sourceIndexPick(pieceIndex: number, pieceCount: number, sourceCount: number): number {
    const lastSourceIndex = sourceCount - 1;
    return pieceIndex === pieceCount - 1 ? lastSourceIndex : Math.min(pieceIndex, lastSourceIndex);
  }
}
