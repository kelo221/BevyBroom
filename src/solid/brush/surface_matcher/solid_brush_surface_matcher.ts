import type { SolidPlane } from '@/solid/brush/solid_plane.js';

/** Index a matcher returns when no source face qualifies. */
export const SOLID_BRUSH_SURFACE_MATCH_NONE = -1;

/**
 * Picks the source brush face whose surface a destination face inherits, by
 * comparing face planes expressed in one shared space.
 */
export abstract class SolidBrushSurfaceMatcher {
  /**
   * Finds the source face a destination face inherits its surface from.
   *
   * @param sourcePlanes Source face planes, indexed like the source faces.
   * @param destinationPlane Destination face plane in the same space.
   * @returns Source face index, or SOLID_BRUSH_SURFACE_MATCH_NONE.
   */
  faceMatchFind(sourcePlanes: readonly SolidPlane[], destinationPlane: SolidPlane): number {
    let bestIndex = SOLID_BRUSH_SURFACE_MATCH_NONE;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let sourceIndex = 0; sourceIndex < sourcePlanes.length; sourceIndex++) {
      const sourcePlane = sourcePlanes[sourceIndex];
      const score = sourcePlane ? this.faceMatchScore(sourcePlane, destinationPlane) : null;
      if (score !== null && score < bestScore) {
        bestScore = score;
        bestIndex = sourceIndex;
      }
    }
    return bestIndex;
  }

  /**
   * Scores how well a source plane fits a destination plane.
   *
   * @param sourcePlane Candidate source face plane.
   * @param destinationPlane Destination face plane.
   * @returns Lower-is-better score, or null when the source does not qualify.
   */
  protected abstract faceMatchScore(sourcePlane: SolidPlane, destinationPlane: SolidPlane): number | null;
}
