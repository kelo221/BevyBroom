import type * as THREE from 'three';

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

/** Smallest angle a tube may cover before it counts as a point, in radians. */
export const SHADING_LIT_TUBE_MIN_ANGLE = 1e-6;

/** Smallest reach a light keeps past its shape, in meters. */
export const SHADING_LIT_MIN_REACH = 1e-3;

/**
 * Returns how far a light reaches past its shape: the radius minus the tube's
 * half length, the radius itself for point-like lights.
 *
 * @param radius Light radius in meters.
 * @param tubeHalfLength Half the tube length; zero for point-like lights.
 * @returns Reach in meters, never below {@link SHADING_LIT_MIN_REACH}.
 */
export function shadingLitReach(radius: number, tubeHalfLength: number): number {
  return Math.max(radius - tubeHalfLength, SHADING_LIT_MIN_REACH);
}

/**
 * Returns the point of a tube segment nearest a world position.
 *
 * @param center Tube center.
 * @param axis Unit tube axis.
 * @param halfLength Half the tube length.
 * @param world Position to measure from.
 * @returns Nearest point on the segment.
 */
export function shadingLitTubeNearestPoint(
  center: THREE.Vector3,
  axis: THREE.Vector3,
  halfLength: number,
  world: THREE.Vector3,
): THREE.Vector3 {
  const along = Math.min(Math.max(world.clone().sub(center).dot(axis), -halfLength), halfLength);
  return center.clone().addScaledVector(axis, along);
}

/**
 * Returns the game renderer's diffuse term of a tube on a baked surface: the
 * mean cosine between the normal and the directions to the part of the tube
 * above the surface's horizon, clamped at zero.
 *
 * @param center Tube center.
 * @param axis Unit tube axis.
 * @param halfLength Half the tube length.
 * @param world Surface position.
 * @param normal Unit surface normal.
 * @returns Diffuse term, 0 to 1.
 */
export function shadingLitTubeCosine(
  center: THREE.Vector3,
  axis: THREE.Vector3,
  halfLength: number,
  world: THREE.Vector3,
  normal: THREE.Vector3,
): number {
  const angle = shadingLitTubeAngle(center, axis, halfLength, world);
  if (angle < SHADING_LIT_TUBE_MIN_ANGLE) {
    return Math.max(normal.dot(center.clone().sub(world).normalize()), 0);
  }
  const ends = shadingLitTubeClippedEnds(center, axis, halfLength, world, normal);
  if (!ends) {
    return 0;
  }
  const arc = shadingLitArcVector(ends[0].normalize(), ends[1].normalize());
  return Math.max(normal.dot(arc) / angle, 0);
}

/**
 * Returns the angle the whole tube covers seen from a surface position.
 *
 * @param center Tube center.
 * @param axis Unit tube axis.
 * @param halfLength Half the tube length.
 * @param world Surface position.
 * @returns Angle in radians.
 */
function shadingLitTubeAngle(
  center: THREE.Vector3,
  axis: THREE.Vector3,
  halfLength: number,
  world: THREE.Vector3,
): number {
  const first = center.clone().addScaledVector(axis, -halfLength).sub(world).normalize();
  const second = center.clone().addScaledVector(axis, halfLength).sub(world).normalize();
  return Math.atan2(first.clone().cross(second).length(), first.dot(second));
}

/**
 * Returns the tube ends relative to a surface position, cut where the tube
 * crosses the surface's horizon.
 *
 * @param center Tube center.
 * @param axis Unit tube axis.
 * @param halfLength Half the tube length.
 * @param world Surface position.
 * @param normal Unit surface normal.
 * @returns Both ends relative to the surface, or null when the tube is below
 *   the horizon.
 */
function shadingLitTubeClippedEnds(
  center: THREE.Vector3,
  axis: THREE.Vector3,
  halfLength: number,
  world: THREE.Vector3,
  normal: THREE.Vector3,
): [THREE.Vector3, THREE.Vector3] | null {
  const start = center.clone().addScaledVector(axis, -halfLength).sub(world);
  const end = center.clone().addScaledVector(axis, halfLength).sub(world);
  const startHeight = normal.dot(start);
  const endHeight = normal.dot(end);
  if (startHeight <= 0 && endHeight <= 0) {
    return null;
  }
  const crossing = start.clone().lerp(end, startHeight / (startHeight - endHeight));
  if (startHeight < 0) {
    return [crossing, end];
  }
  return endHeight < 0 ? [start, crossing] : [start, end];
}

/**
 * Returns the integral of the direction over the great arc between two unit
 * vectors, as the game renderer computes it.
 *
 * @param first First unit vector.
 * @param second Second unit vector.
 * @returns Arc vector.
 */
function shadingLitArcVector(first: THREE.Vector3, second: THREE.Vector3): THREE.Vector3 {
  const scale = first.clone().cross(second).length() / Math.max(1 + first.dot(second), 1e-6);
  return first.clone().add(second).multiplyScalar(scale);
}
