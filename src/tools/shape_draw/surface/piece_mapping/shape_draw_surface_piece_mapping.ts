/** Index a piece mapping returns when there are no old pieces. */
export const SHAPE_DRAW_SURFACE_PIECE_MAPPING_NONE = -1;

/**
 * Chooses which old piece of a regenerated shape group a new piece takes its
 * face surfaces from.
 */
export abstract class ShapeDrawSurfacePieceMapping {
  /**
   * Resolves the old piece index a new piece inherits from.
   *
   * @param pieceIndex New piece index.
   * @param pieceCount Number of new pieces.
   * @param sourceCount Number of old pieces.
   * @returns Old piece index, or SHAPE_DRAW_SURFACE_PIECE_MAPPING_NONE when
   *   there are no old pieces.
   */
  sourceIndexResolve(pieceIndex: number, pieceCount: number, sourceCount: number): number {
    if (sourceCount <= 0) {
      return SHAPE_DRAW_SURFACE_PIECE_MAPPING_NONE;
    }
    const sourceIndex = this.sourceIndexPick(pieceIndex, pieceCount, sourceCount);
    return Math.min(Math.max(sourceIndex, 0), sourceCount - 1);
  }

  /**
   * Picks the old piece index for a new piece when at least one old piece
   * exists.
   *
   * @param pieceIndex New piece index.
   * @param pieceCount Number of new pieces.
   * @param sourceCount Number of old pieces, at least one.
   * @returns Old piece index; values outside the old range are clamped by the
   *   caller.
   */
  protected abstract sourceIndexPick(pieceIndex: number, pieceCount: number, sourceCount: number): number;
}
