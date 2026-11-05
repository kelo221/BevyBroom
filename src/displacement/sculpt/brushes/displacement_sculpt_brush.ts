import * as THREE from 'three';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';

/** One paint dab of a sculpt stroke. */
export interface DisplacementSculptDab {
  /** World-space point the dab is centered on. */
  center: THREE.Vector3;
  /** World radius of the dab. */
  radius: number;
  /** World distance a vertex at the dab center moves per dab. */
  distance: number;
  /** 1 raises, -1 lowers. */
  direction: 1 | -1;
}

/**
 * Returns the cosine falloff weight of a vertex inside a dab: 1 at the center,
 * easing to 0 at the radius.
 *
 * @param distance World distance from the dab center.
 * @param radius Dab radius.
 * @returns Weight between 0 and 1.
 */
export function displacementSculptFalloffCosine(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  return 0.5 * (1 + Math.cos((Math.PI * distance) / radius));
}

/**
 * Base of every displacement paint brush. A dab weighs each displaced vertex by
 * its world distance to the dab center and lets the brush move the weighted
 * vertices' offsets.
 */
export abstract class DisplacementSculptBrush {
  private readonly scratchPosition = new THREE.Vector3();

  /**
   * Applies one dab to a sculpt face.
   *
   * @param face Sculpt face whose offsets change.
   * @param dab Dab center, radius and strength.
   * @returns True when at least one vertex was inside the dab.
   */
  dabApply(face: DisplacementSculptFace, dab: DisplacementSculptDab): boolean {
    const weights = this.weightsCompute(face, dab);
    if (!weights.some((weight) => weight > 0)) {
      return false;
    }
    this.offsetsBlend(face, weights, dab);
    return true;
  }

  /**
   * Moves the offsets of the vertices inside the dab.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights, zero outside the dab.
   * @param dab Dab parameters.
   */
  protected abstract offsetsBlend(
    face: DisplacementSculptFace,
    weights: readonly number[],
    dab: DisplacementSculptDab,
  ): void;

  /**
   * Replaces the offset of every vertex with a positive weight.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights.
   * @param offsetNext Returns the new offset of a vertex from its index and
   *   weight.
   */
  protected offsetsWriteWeighted(
    face: DisplacementSculptFace,
    weights: readonly number[],
    offsetNext: (vertexIndex: number, weight: number) => number,
  ): void {
    const offsets = face.displacement.offsets;
    weights.forEach((weight, vertexIndex) => {
      if (weight > 0) {
        offsets[vertexIndex] = offsetNext(vertexIndex, weight);
      }
    });
  }

  /**
   * Weighs every displaced vertex by its world distance to the dab center.
   *
   * @param face Sculpt face.
   * @param dab Dab parameters.
   * @returns Per-vertex weights.
   */
  private weightsCompute(face: DisplacementSculptFace, dab: DisplacementSculptDab): number[] {
    return face.displacement.offsets.map((_offset, vertexIndex) => {
      face.placement.displacedPositionWrite(face.displacement, vertexIndex, this.scratchPosition);
      return displacementSculptFalloffCosine(this.scratchPosition.distanceTo(dab.center), dab.radius);
    });
  }
}
