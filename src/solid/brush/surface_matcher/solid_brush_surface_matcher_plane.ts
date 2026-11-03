import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidBrushSurfaceMatcher } from './solid_brush_surface_matcher.js';

/** Matches only coplanar source faces with the same orientation. */
export class SolidBrushSurfaceMatcherPlane extends SolidBrushSurfaceMatcher {
  /**
   * Accepts a source plane only when it is aligned with the destination plane.
   *
   * @param sourcePlane Candidate source face plane.
   * @param destinationPlane Destination face plane.
   * @returns Zero for an aligned plane, otherwise null.
   */
  protected faceMatchScore(sourcePlane: SolidPlane, destinationPlane: SolidPlane): number | null {
    return sourcePlane.isAlignedWith(destinationPlane) ? 0 : null;
  }
}
