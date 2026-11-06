import type * as THREE from 'three';
import type { DisplacementSculptEdge } from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import {
  displacementSculptFalloffRead,
  displacementSculptNearestVertexRead,
  displacementSculptVertexDistancesRead,
} from './displacement_sculpt_weights.js';

/** One paint dab of a sculpt stroke. */
export interface DisplacementSculptDab {
  /** World-space point the dab is centered on. */
  center: THREE.Vector3;
  /** World radius of the dab. */
  radius: number;
  /**
   * World distance a vertex at the dab center moves per dab; Raise To uses it
   * as the target height along the axis.
   */
  distance: number;
  /**
   * 1 raises (or paints towards the alpha value), -1 lowers (or paints towards
   * 0).
   */
  direction: 1 | -1;
  /** Falloff of the dab. */
  edge: DisplacementSculptEdge;
  /** False weighs only the vertex nearest the center. */
  spatial: boolean;
  /** Unit world axis vertices move along, or null for the face normal. */
  axis: THREE.Vector3 | null;
  /** Alpha Paint Alpha paints towards. */
  alphaValue: number;
}

/**
 * Base of every displacement paint brush. A dab weighs each displaced vertex by
 * its world distance to the dab center and lets the brush move the weighted
 * vertices' offsets or alphas.
 */
export abstract class DisplacementSculptBrush {
  /**
   * Applies one dab to a sculpt face.
   *
   * @param face Sculpt face whose vertices change.
   * @param dab Dab center, radius, strength, falloff and axis.
   * @returns True when an offset or alpha changed.
   */
  dabApply(face: DisplacementSculptFace, dab: DisplacementSculptDab): boolean {
    const weights = this.weightsCompute(face, dab);
    if (!weights.some((weight) => weight > 0)) {
      return false;
    }
    const offsetsBefore = face.displacement.offsets.slice();
    const alphasBefore = face.displacement.alphas.slice();
    this.verticesBlend(face, weights, dab);
    return (
      DisplacementSculptBrush.valuesDiffer(offsetsBefore, face.displacement.offsets) ||
      DisplacementSculptBrush.valuesDiffer(alphasBefore, face.displacement.alphas)
    );
  }

  /**
   * Moves the offsets or alphas of the vertices inside the dab.
   *
   * @param face Sculpt face whose vertices change.
   * @param weights Per-vertex falloff weights, zero outside the dab.
   * @param dab Dab parameters.
   */
  protected abstract verticesBlend(
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
    DisplacementSculptBrush.valuesWriteWeighted(face.displacement.offsets, weights, offsetNext);
  }

  /**
   * Replaces the alpha of every vertex with a positive weight.
   *
   * @param face Sculpt face whose alphas change.
   * @param weights Per-vertex falloff weights.
   * @param alphaNext Returns the new alpha of a vertex from its index and
   *   weight.
   */
  protected alphasWriteWeighted(
    face: DisplacementSculptFace,
    weights: readonly number[],
    alphaNext: (vertexIndex: number, weight: number) => number,
  ): void {
    DisplacementSculptBrush.valuesWriteWeighted(face.displacement.alphas, weights, alphaNext);
  }

  /**
   * Weighs every displaced vertex by its world distance to the dab center, or
   * gives only the nearest vertex full weight when the dab is not spatial.
   *
   * @param face Sculpt face.
   * @param dab Dab parameters.
   * @returns Per-vertex weights.
   */
  private weightsCompute(face: DisplacementSculptFace, dab: DisplacementSculptDab): number[] {
    if (!dab.spatial) {
      const nearest = displacementSculptNearestVertexRead(face, dab.center);
      return face.displacement.offsets.map((_offset, vertexIndex) => (vertexIndex === nearest?.vertexIndex ? 1 : 0));
    }
    return displacementSculptVertexDistancesRead(face, dab.center).map((distance) =>
      displacementSculptFalloffRead(dab.edge, distance, dab.radius),
    );
  }

  /**
   * Replaces every entry of a value list whose weight is positive.
   *
   * @param values Per-vertex values changed in place.
   * @param weights Per-vertex weights.
   * @param valueNext Returns the new value from the vertex index and weight.
   */
  private static valuesWriteWeighted(
    values: number[],
    weights: readonly number[],
    valueNext: (vertexIndex: number, weight: number) => number,
  ): void {
    weights.forEach((weight, vertexIndex) => {
      if (weight > 0) {
        values[vertexIndex] = valueNext(vertexIndex, weight);
      }
    });
  }

  /**
   * Returns whether two value lists differ anywhere.
   *
   * @param before Values before the dab.
   * @param after Values after the dab.
   * @returns True when any entry changed.
   */
  private static valuesDiffer(before: readonly number[], after: readonly number[]): boolean {
    return after.some((value, index) => value !== before[index]);
  }
}
