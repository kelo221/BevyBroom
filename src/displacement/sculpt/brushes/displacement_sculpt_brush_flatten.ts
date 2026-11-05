import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush } from './displacement_sculpt_brush.js';

/** Blends vertices towards the weighted mean height under the dab. */
export class DisplacementSculptBrushFlatten extends DisplacementSculptBrush {
  /**
   * Blends each weighted vertex towards the weighted mean offset of the dab.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights, used as blend strength.
   */
  protected offsetsBlend(face: DisplacementSculptFace, weights: readonly number[]): void {
    const offsets = face.displacement.offsets;
    const target = this.weightedMean(offsets, weights);
    this.offsetsWriteWeighted(face, weights, (vertexIndex, weight) => {
      const current = offsets[vertexIndex] ?? 0;
      return current + (target - current) * weight;
    });
  }

  /**
   * Computes the weight-averaged offset.
   *
   * @param offsets Per-vertex offsets.
   * @param weights Per-vertex weights.
   * @returns Weighted mean, zero when every weight is zero.
   */
  private weightedMean(offsets: readonly number[], weights: readonly number[]): number {
    let sum = 0;
    let total = 0;
    weights.forEach((weight, vertexIndex) => {
      sum += (offsets[vertexIndex] ?? 0) * weight;
      total += weight;
    });
    return total > 0 ? sum / total : 0;
  }
}
