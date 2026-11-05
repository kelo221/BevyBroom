import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush, type DisplacementSculptDab } from './displacement_sculpt_brush.js';

/** Raises or lowers vertices along the face normal, strongest at the dab center. */
export class DisplacementSculptBrushRaiseLower extends DisplacementSculptBrush {
  /**
   * Moves each weighted vertex by the dab distance times its weight.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights.
   * @param dab Dab parameters.
   */
  protected offsetsBlend(face: DisplacementSculptFace, weights: readonly number[], dab: DisplacementSculptDab): void {
    const offsets = face.displacement.offsets;
    this.offsetsWriteWeighted(
      face,
      weights,
      (vertexIndex, weight) =>
        (offsets[vertexIndex] ?? 0) + face.offsetDeltaForDistance(dab.direction * dab.distance * weight),
    );
  }
}
