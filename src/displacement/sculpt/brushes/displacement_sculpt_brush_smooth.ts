import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { displacementNeighborhoodAverage } from '@/displacement/grid/displacement_grid_neighborhood.js';
import { DisplacementSculptBrush } from './displacement_sculpt_brush.js';

/** Blends vertices towards the 3x3 average of their neighbors. */
export class DisplacementSculptBrushSmooth extends DisplacementSculptBrush {
  /**
   * Blends each weighted vertex towards its neighborhood average taken before
   * the dab.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights, used as blend strength.
   */
  protected offsetsBlend(face: DisplacementSculptFace, weights: readonly number[]): void {
    const before = face.displacement.offsets.slice();
    const rowLength = face.rowLength();
    this.offsetsWriteWeighted(face, weights, (vertexIndex, weight) => {
      const current = before[vertexIndex] ?? 0;
      return current + (displacementNeighborhoodAverage(before, rowLength, vertexIndex) - current) * weight;
    });
  }
}
