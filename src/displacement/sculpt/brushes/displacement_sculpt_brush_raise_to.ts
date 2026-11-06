import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import type { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptBrush, type DisplacementSculptDab } from './displacement_sculpt_brush.js';

/** Distance in meters below which a vertex counts as already at the target. */
const DISPLACEMENT_SCULPT_RAISE_TO_GAP_MIN = 1e-9;

/**
 * Moves vertices towards a target height: the dab distance, measured as height
 * above the flat face for the face normal axis or as a world coordinate for a
 * world axis. Each vertex closes its weight's share of the gap, so it never
 * overshoots and vertices already at the target stay put.
 */
export class DisplacementSculptBrushRaiseTo extends DisplacementSculptBrush {
  /**
   * Blends each weighted vertex towards the target height along the dab axis.
   * Does nothing when the axis lies in the face plane.
   *
   * @param face Sculpt face whose offsets change.
   * @param weights Per-vertex falloff weights, used as blend strength.
   * @param dab Dab parameters; distance is the target height.
   */
  protected verticesBlend(face: DisplacementSculptFace, weights: readonly number[], dab: DisplacementSculptDab): void {
    const axisFactor = face.axisFactorRead(dab.axis);
    if (axisFactor === 0) {
      return;
    }
    this.offsetsWriteWeighted(face, weights, (vertexIndex, weight) => {
      const gap = dab.distance - face.axisCoordinateRead(dab.axis, vertexIndex);
      if (Math.abs(gap) < DISPLACEMENT_SCULPT_RAISE_TO_GAP_MIN) {
        return face.displacement.offsets[vertexIndex] ?? 0;
      }
      const height = DisplacementSurfacePlacement.heightRead(face.displacement, vertexIndex);
      return face.offsetForHeight(height + (gap * weight) / axisFactor);
    });
  }
}
