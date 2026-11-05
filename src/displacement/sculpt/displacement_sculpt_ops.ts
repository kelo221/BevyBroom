import { SprinklePrng } from '@/tools/sprinkle/sprinkle_prng.js';
import {
  DISPLACEMENT_ALPHA_MAX,
  DISPLACEMENT_POWERS,
  type DisplacementFaceSurface,
  type DisplacementPower,
} from '@/displacement/model/displacement_types.js';
import {
  displacementOffsetDeltaForDistance,
  displacementRowLength,
} from '@/displacement/model/displacement_face_surface.js';
import { displacementNeighborhoodAverage } from '@/displacement/grid/displacement_grid_neighborhood.js';
import { displacementGridResample } from '@/displacement/grid/displacement_grid_resample.js';
import type { DisplacementSculptBrush, DisplacementSculptDab } from './brushes/displacement_sculpt_brush.js';
import type { DisplacementSculptFace } from './displacement_sculpt_face.js';

/**
 * Whole-face and paint operations on displacement data. Every operation changes
 * the given displacement in place, except subdivide which returns a new one.
 */
export class DisplacementSculptOps {
  /**
   * Applies one paint dab to every face it reaches.
   *
   * @param faces Sculpt faces under the stroke.
   * @param dab Dab center, radius and strength.
   * @param brush Paint brush deciding how offsets move.
   * @returns Faces that changed.
   */
  static paintGeometry(
    faces: readonly DisplacementSculptFace[],
    dab: DisplacementSculptDab,
    brush: DisplacementSculptBrush,
  ): DisplacementSculptFace[] {
    return faces.filter((face) => brush.dabApply(face, dab));
  }

  /**
   * Replaces every offset with the 3x3 average of its neighborhood.
   *
   * @param displacement Displacement to smooth.
   */
  static smoothGeometry(displacement: DisplacementFaceSurface): void {
    const before = displacement.offsets.slice();
    const rowLength = displacementRowLength(displacement.power);
    displacement.offsets = before.map((_offset, vertexIndex) =>
      displacementNeighborhoodAverage(before, rowLength, vertexIndex),
    );
  }

  /**
   * Adds a seeded random distance between min and max meters to every vertex.
   *
   * @param displacement Displacement to roughen.
   * @param minDistance Smallest added distance in meters.
   * @param maxDistance Largest added distance in meters.
   * @param seed Random seed.
   */
  static applyNoise(
    displacement: DisplacementFaceSurface,
    minDistance: number,
    maxDistance: number,
    seed: number,
  ): void {
    const random = new SprinklePrng(seed);
    const low = Math.min(minDistance, maxDistance);
    const high = Math.max(minDistance, maxDistance);
    displacement.offsets = displacement.offsets.map(
      (offset) => offset + displacementOffsetDeltaForDistance(displacement, random.range(low, high)),
    );
  }

  /**
   * Doubles the grid resolution, keeping the sculpted shape and alphas.
   *
   * @param displacement Displacement to subdivide.
   * @returns Displacement one power higher, or null at the highest power.
   */
  static subdivide(displacement: Readonly<DisplacementFaceSurface>): DisplacementFaceSurface | null {
    const nextPower = DisplacementSculptOps.powerNextRead(displacement.power);
    if (nextPower === null) {
      return null;
    }
    const sourceRowLength = displacementRowLength(displacement.power);
    const targetRowLength = displacementRowLength(nextPower);
    return {
      power: nextPower,
      elevation: displacement.elevation,
      scale: displacement.scale,
      offsets: displacementGridResample(displacement.offsets, sourceRowLength, targetRowLength),
      alphas: displacementGridResample(displacement.alphas, sourceRowLength, targetRowLength),
    };
  }

  /**
   * Flips every alpha so painted blend areas swap with unpainted ones.
   *
   * @param displacement Displacement whose alphas flip.
   */
  static invertAlpha(displacement: DisplacementFaceSurface): void {
    displacement.alphas = displacement.alphas.map((alpha) => DISPLACEMENT_ALPHA_MAX - alpha);
  }

  /**
   * Returns the power one step above a power.
   *
   * @param power Current power.
   * @returns Next power, or null at the highest power.
   */
  private static powerNextRead(power: DisplacementPower): DisplacementPower | null {
    const index = DISPLACEMENT_POWERS.indexOf(power);
    return DISPLACEMENT_POWERS[index + 1] ?? null;
  }
}
