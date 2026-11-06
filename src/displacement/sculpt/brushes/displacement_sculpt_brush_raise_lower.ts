import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush, type DisplacementSculptDab } from './displacement_sculpt_brush.js';

/**
 * Raises or lowers vertices, strongest at the dab center. Along a world axis a
 * vertex moves by the dab distance times the axis' share of the face normal, so
 * faces at right angles to the axis stay put.
 */
export class DisplacementSculptBrushRaiseLower extends DisplacementSculptBrush {
  /**
   * Moves each weighted vertex by the dab distance times its weight and the
   * axis projection factor.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights.
   * @param dab Dab parameters.
   */
  protected verticesBlend(face: DisplacementSculptFace, weights: readonly number[], dab: DisplacementSculptDab): void {
    const offsets = face.displacement.offsets;
    const axisFactor = face.axisFactorRead(dab.axis);
    this.offsetsWriteWeighted(
      face,
      weights,
      (vertexIndex, weight) =>
        (offsets[vertexIndex] ?? 0) + face.offsetDeltaForDistance(dab.direction * dab.distance * weight * axisFactor),
    );
  }
}
