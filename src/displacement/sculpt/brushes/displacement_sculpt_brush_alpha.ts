import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush, type DisplacementSculptDab } from './displacement_sculpt_brush.js';

/**
 * Paints texture blend alphas: blends weighted vertices towards the dab's alpha
 * value, or towards 0 when the dab lowers, clamped to 0 to
 * DISPLACEMENT_ALPHA_MAX. Offsets stay unchanged.
 */
export class DisplacementSculptBrushAlpha extends DisplacementSculptBrush {
  /**
   * Blends each weighted vertex's alpha towards the target alpha.
   *
   * @param face Sculpt face whose alphas change.
   * @param weights Per-vertex falloff weights, used as blend strength.
   * @param dab Dab parameters; direction picks the alpha value or 0.
   */
  protected verticesBlend(face: DisplacementSculptFace, weights: readonly number[], dab: DisplacementSculptDab): void {
    const alphas = face.displacement.alphas;
    const target = dab.direction > 0 ? dab.alphaValue : 0;
    this.alphasWriteWeighted(face, weights, (vertexIndex, weight) => {
      const current = alphas[vertexIndex] ?? 0;
      return DisplacementSculptBrushAlpha.alphaClamp(current + (target - current) * weight);
    });
  }

  /**
   * Clamps an alpha to the stored alpha range.
   *
   * @param alpha Candidate alpha.
   * @returns Alpha between 0 and DISPLACEMENT_ALPHA_MAX.
   */
  private static alphaClamp(alpha: number): number {
    return Math.min(DISPLACEMENT_ALPHA_MAX, Math.max(0, alpha));
  }
}
