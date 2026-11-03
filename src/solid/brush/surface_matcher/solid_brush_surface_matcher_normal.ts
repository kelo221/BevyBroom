import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SOLID_NORMAL_ALIGN_EPSILON } from '@/solid/algorithm/math/solid_math_constants.js';
import { SolidBrushSurfaceMatcher } from './solid_brush_surface_matcher.js';

/**
 * Matches source faces facing the same direction, preferring the one whose
 * plane offset is closest, so moved but parallel faces still match.
 */
export class SolidBrushSurfaceMatcherNormal extends SolidBrushSurfaceMatcher {
  /**
   * Scores a parallel source plane by its offset distance to the destination.
   *
   * @param sourcePlane Candidate source face plane.
   * @param destinationPlane Destination face plane.
   * @returns Absolute offset difference, or null when the normals differ.
   */
  protected faceMatchScore(sourcePlane: SolidPlane, destinationPlane: SolidPlane): number | null {
    if (sourcePlane.normal.dot(destinationPlane.normal) < SOLID_NORMAL_ALIGN_EPSILON) {
      return null;
    }
    return Math.abs(sourcePlane.offset - destinationPlane.offset);
  }
}
