import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidBrushSurfaceMatcher } from './solid_brush_surface_matcher.js';

/**
 * Matches the source face whose normal points most closely along the
 * destination normal, accepting any source face within ninety degrees.
 */
export class SolidBrushSurfaceMatcherFacing extends SolidBrushSurfaceMatcher {
  /**
   * Scores a source plane by how far its normal turns from the destination.
   *
   * @param sourcePlane Candidate source face plane.
   * @param destinationPlane Destination face plane.
   * @returns One minus the normal dot product, or null when facing away.
   */
  protected faceMatchScore(sourcePlane: SolidPlane, destinationPlane: SolidPlane): number | null {
    const normalDot = sourcePlane.normal.dot(destinationPlane.normal);
    return normalDot > 0 ? 1 - normalDot : null;
  }
}
