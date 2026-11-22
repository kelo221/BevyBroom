/**
 * Ambient light of the Lit shading mode in linear RGB per channel: the game
 * renderer's default ambient (white at alpha 32/255, used as alpha squared).
 */
export const SHADING_LIT_AMBIENT_LINEAR = (32 / 255) * (32 / 255);

/** Cone cosine given to point lights so their cone term is always one. */
export const SHADING_LIT_POINT_CONE_COSINE = -2;

/** Cutoff cosine difference below which a spot cone has a hard edge. */
export const SHADING_LIT_CONE_HARD_EDGE_EPSILON = 1e-6;

/**
 * Returns the falloff value the game renderer stores for a point or spot light:
 * the radius times the authored falloff squared.
 *
 * @param radius Light radius in meters.
 * @param falloff Authored falloff, 0 to 1.
 * @returns Falloff used by the attenuation formula.
 */
export function shadingLitFalloffPacked(radius: number, falloff: number): number {
  return radius * falloff * falloff;
}

/**
 * Returns the light strength at a distance with the game renderer's smooth
 * falloff: intensity · (1 − s)² / (1 + falloff · s), s = d² / r² clamped to 1.
 *
 * @param intensity Light intensity.
 * @param radiusSquared Light radius squared.
 * @param falloffPacked Falloff from {@link shadingLitFalloffPacked}.
 * @param distanceSquared Squared distance from the light.
 * @returns Strength, zero at and beyond the radius.
 */
export function shadingLitAttenuation(
  intensity: number,
  radiusSquared: number,
  falloffPacked: number,
  distanceSquared: number,
): number {
  const ratio = Math.min(Math.max(distanceSquared / radiusSquared, 0), 1);
  const remaining = 1 - ratio;
  return (intensity * remaining * remaining) / (1 + falloffPacked * ratio);
}

/**
 * Returns the spot cone term with the game renderer's linear edge between the
 * outer and inner cutoff cosines; equal cutoffs give a hard edge.
 *
 * @param theta Cosine between the spot axis and the direction to the light.
 * @param innerCosine Cosine of the inner cutoff angle.
 * @param outerCosine Cosine of the outer cutoff angle.
 * @returns Cone term, 0 to 1.
 */
export function shadingLitCone(theta: number, innerCosine: number, outerCosine: number): number {
  if (theta <= outerCosine) {
    return 0;
  }
  const edgeWidth = innerCosine - outerCosine;
  if (Math.abs(edgeWidth) <= SHADING_LIT_CONE_HARD_EDGE_EPSILON) {
    return theta >= innerCosine ? 1 : 0;
  }
  return Math.min(Math.max((theta - outerCosine) / edgeWidth, 0), 1);
}

/**
 * Returns the cosine of an angle given in degrees.
 *
 * @param degrees Angle in degrees.
 * @returns Cosine of the angle.
 */
export function shadingLitCosineFromDegrees(degrees: number): number {
  return Math.cos((degrees * Math.PI) / 180);
}
