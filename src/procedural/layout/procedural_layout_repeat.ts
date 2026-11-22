import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/** Length tolerance below which two lengths count as equal, in meters. */
const PROCEDURAL_LAYOUT_REPEAT_EPSILON = 1e-9;

/**
 * Places repeated fixed-size pieces along a run: pieces never change size, only
 * the gaps between them stretch. The first and last piece sit flush to the ends
 * of the run and the pieces between are spread evenly, snapped to the finest
 * grid.
 */
export class ProceduralLayoutRepeat {
  /**
   * Returns the piece positions for the fewest pieces whose neighbours are
   * never further apart than a maximum spacing.
   *
   * @param runLength Length of the run in meters.
   * @param pieceWidth Width of one piece along the run.
   * @param maxSpacing Largest allowed distance between the start of one piece
   *   and the start of the next; it should be at least two finest grid steps,
   *   because snapping can add one step.
   * @returns Start of every piece along the run, ascending; empty when the run
   *   is shorter than one piece.
   */
  static positionsByMaxSpacing(runLength: number, pieceWidth: number, maxSpacing: number): number[] {
    const span = runLength - pieceWidth;
    if (span < -PROCEDURAL_LAYOUT_REPEAT_EPSILON) {
      return [];
    }
    const usableSpacing = Math.max(maxSpacing - GRID_INTERVAL_MINIMUM, GRID_INTERVAL_MINIMUM);
    const gapCount = Math.max(0, Math.ceil(span / usableSpacing - PROCEDURAL_LAYOUT_REPEAT_EPSILON));
    return ProceduralLayoutRepeat.positionsByCount(runLength, pieceWidth, gapCount + 1);
  }

  /**
   * Returns the positions of a given number of pieces spread evenly along a
   * run.
   *
   * @param runLength Length of the run in meters.
   * @param pieceWidth Width of one piece along the run.
   * @param count Number of pieces; a single piece is centered.
   * @returns Start of every piece along the run, ascending; empty when the run
   *   is shorter than one piece or the count is below one.
   */
  static positionsByCount(runLength: number, pieceWidth: number, count: number): number[] {
    const span = runLength - pieceWidth;
    if (count < 1 || span < -PROCEDURAL_LAYOUT_REPEAT_EPSILON) {
      return [];
    }
    const usableSpan = Math.max(0, span);
    if (count === 1) {
      return [ProceduralLayoutRepeat.gridSnapWithin(usableSpan / 2, usableSpan)];
    }
    return Array.from({ length: count }, (_, index) => ProceduralLayoutRepeat.positionAt(index, count, usableSpan));
  }

  /**
   * Returns the start of one piece of an evenly spread row.
   *
   * @param index Index of the piece, zero for the first.
   * @param count Number of pieces in the row, at least two.
   * @param span Distance between the start of the first and of the last piece.
   * @returns Zero for the first piece, the span for the last, else the even
   *   position snapped to the grid.
   */
  private static positionAt(index: number, count: number, span: number): number {
    if (index === 0) {
      return 0;
    }
    if (index === count - 1) {
      return span;
    }
    return ProceduralLayoutRepeat.gridSnapWithin((span * index) / (count - 1), span);
  }

  /**
   * Snaps a value to the finest grid without leaving a range.
   *
   * @param value Value to snap.
   * @param maximum Largest allowed result; the smallest is zero.
   * @returns The snapped value.
   */
  private static gridSnapWithin(value: number, maximum: number): number {
    return Math.min(maximum, Math.max(0, ProceduralLayoutRepeat.gridSnap(value)));
  }

  /**
   * Snaps a value to the finest grid.
   *
   * @param value Value to snap.
   * @returns The nearest multiple of the finest grid step.
   */
  static gridSnap(value: number): number {
    return Math.round(value / GRID_INTERVAL_MINIMUM) * GRID_INTERVAL_MINIMUM;
  }
}
