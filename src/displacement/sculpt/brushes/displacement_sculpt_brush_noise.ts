import { SprinklePrng } from '@/tools/sprinkle/sprinkle_prng.js';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush, type DisplacementSculptDab } from './displacement_sculpt_brush.js';

/** Adds seeded random bumps of up to the dab distance, faded by the falloff. */
export class DisplacementSculptBrushNoise extends DisplacementSculptBrush {
  private readonly random: SprinklePrng;

  /**
   * Creates a noise brush with a reproducible random stream.
   *
   * @param seed Random seed.
   */
  constructor(seed: number) {
    super();
    this.random = new SprinklePrng(seed);
  }

  /**
   * Moves each weighted vertex by a random distance between minus and plus the
   * dab distance, times its weight.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights.
   * @param dab Dab parameters.
   */
  protected verticesBlend(face: DisplacementSculptFace, weights: readonly number[], dab: DisplacementSculptDab): void {
    const offsets = face.displacement.offsets;
    this.offsetsWriteWeighted(face, weights, (vertexIndex, weight) => {
      const bump = this.random.range(-dab.distance, dab.distance) * weight;
      return (offsets[vertexIndex] ?? 0) + face.offsetDeltaForDistance(bump);
    });
  }
}
