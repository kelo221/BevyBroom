import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { type DataOrientedBounds } from './builder_oriented_bounds.js';
import { getCadViewPlaneAxes, type CadLocalAxis, type CadViewPlane } from '@/rulers/view/cad_view_plane.js';

/**
 * Exterior-only pick band for 2D silhouette edges as a fraction of the larger
 * in-plane half extent. Resize never starts inside the OBB — only on the wire
 * from outside or slightly past the exterior (body drag owns the interior).
 */
export const BOUNDS_SILHOUETTE_EXTERIOR_BAND_RATIO = 0.05;

/** Minimum exterior band in world units (still small). */
export const BOUNDS_SILHOUETTE_EXTERIOR_MIN_BAND = 0.05;

/** Maximum exterior band so large boxes do not get a huge resize rim. */
export const BOUNDS_SILHOUETTE_EXTERIOR_MAX_BAND = 0.12;

/**
 * Picks a one-sided resize face from a world point on the 2D silhouette of the
 * OBB. Hits must be on the exterior side of an edge (including the wire
 * itself); anything strictly inside the OBB is body-drag only. Returns null in
 * 3D or when not near an exterior edge.
 *
 * @param worldPoint Point in the orthographic view plane (typically ray hit).
 * @param bounds Current oriented bounds.
 * @param viewPlane Active orthographic plane (`xz` / `xy` / `yz`).
 * @param exteriorBandWorld Optional screen-derived exterior band in world
 *   units. When omitted, uses a small OBB-relative fallback.
 * @returns Bounds face for that edge, or null.
 */
export function pickOrthographicSilhouetteEdgeFace(
  worldPoint: THREE.Vector3,
  bounds: DataOrientedBounds,
  viewPlane: CadViewPlane,
  exteriorBandWorld?: number,
): BoundsFace | null {
  const axes = getCadViewPlaneAxes(viewPlane);
  if (axes.depthAxis === null) return null;
  const local = worldPointToBoundsLocal(worldPoint, bounds);
  const halfU = componentOf(bounds.halfExtents, axes.axisU);
  const halfV = componentOf(bounds.halfExtents, axes.axisV);
  const u = componentOf(local, axes.axisU);
  const v = componentOf(local, axes.axisV);
  const exteriorBand =
    exteriorBandWorld !== undefined && exteriorBandWorld > 0
      ? exteriorBandWorld
      : computeSilhouetteExteriorBandFallback(halfU, halfV);
  return nearestSilhouetteEdgeFace(u, v, halfU, halfV, exteriorBand, axes.axisU, axes.axisV);
}

/**
 * Fallback exterior band when no screen-space camera conversion is available.
 *
 * @param halfU In-plane half extent along U.
 * @param halfV In-plane half extent along V.
 * @returns World-unit exterior band.
 */
function computeSilhouetteExteriorBandFallback(halfU: number, halfV: number): number {
  const fromRatio = Math.max(halfU, halfV) * BOUNDS_SILHOUETTE_EXTERIOR_BAND_RATIO;
  return Math.min(BOUNDS_SILHOUETTE_EXTERIOR_MAX_BAND, Math.max(BOUNDS_SILHOUETTE_EXTERIOR_MIN_BAND, fromRatio));
}

/**
 * Converts a world point into bounds-local coordinates.
 *
 * @param worldPoint World-space point.
 * @param bounds Oriented bounds.
 * @returns Local coordinates relative to the OBB center.
 */
function worldPointToBoundsLocal(worldPoint: THREE.Vector3, bounds: DataOrientedBounds): THREE.Vector3 {
  return worldPoint.clone().sub(bounds.center).applyQuaternion(bounds.quaternion.clone().invert());
}

/**
 * Reads one axis component from a vector.
 *
 * @param vector Source vector.
 * @param axis Local axis index.
 * @returns Component value.
 */
function componentOf(vector: THREE.Vector3, axis: CadLocalAxis): number {
  if (axis === 0) return vector.x;
  if (axis === 1) return vector.y;
  return vector.z;
}

/**
 * Chooses the nearest in-plane silhouette edge using an exterior-only band.
 *
 * @param u Local coordinate along view U.
 * @param v Local coordinate along view V.
 * @param halfU Half extent along U.
 * @param halfV Half extent along V.
 * @param exteriorBand Allowed distance on/outside the wire.
 * @param axisU Local axis index for U.
 * @param axisV Local axis index for V.
 * @returns Matching bounds face, or null when not near an exterior edge.
 */
function nearestSilhouetteEdgeFace(
  u: number,
  v: number,
  halfU: number,
  halfV: number,
  exteriorBand: number,
  axisU: CadLocalAxis,
  axisV: CadLocalAxis,
): BoundsFace | null {
  type Candidate = { face: BoundsFace; distance: number };
  const candidates: Candidate[] = [];
  pushExteriorEdgeCandidate(candidates, u, halfU, v, halfV, exteriorBand, positiveFaceForAxis(axisU));
  pushExteriorEdgeCandidate(candidates, -u, halfU, v, halfV, exteriorBand, negativeFaceForAxis(axisU));
  pushExteriorEdgeCandidate(candidates, v, halfV, u, halfU, exteriorBand, positiveFaceForAxis(axisV));
  pushExteriorEdgeCandidate(candidates, -v, halfV, u, halfU, exteriorBand, negativeFaceForAxis(axisV));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]!.face;
}

/**
 * Adds a candidate when the pointer is on or outside one positive-side edge
 * (never strictly inside the OBB).
 *
 * @param candidates Output list.
 * @param along Coordinate along the outward edge normal (edge at +halfAlong).
 * @param halfAlong Half extent along the edge normal.
 * @param across Coordinate along the edge.
 * @param halfAcross Half extent along the edge.
 * @param exteriorBand Exterior pick thickness.
 * @param face Face for this edge.
 */
function pushExteriorEdgeCandidate(
  candidates: Array<{ face: BoundsFace; distance: number }>,
  along: number,
  halfAlong: number,
  across: number,
  halfAcross: number,
  exteriorBand: number,
  face: BoundsFace,
): void {
  const outside = along - halfAlong;
  const epsilon = 1e-6;
  if (outside < -epsilon || outside > exteriorBand + epsilon) return;
  if (Math.abs(across) > halfAcross + exteriorBand + epsilon) return;
  candidates.push({ face, distance: Math.max(0, outside) });
}

/**
 * Maps a local axis to its positive bounds face.
 *
 * @param axis Local axis index.
 * @returns Positive face enum.
 */
function positiveFaceForAxis(axis: CadLocalAxis): BoundsFace {
  if (axis === 0) return BoundsFace.POS_X;
  if (axis === 1) return BoundsFace.POS_Y;
  return BoundsFace.POS_Z;
}

/**
 * Maps a local axis to its negative bounds face.
 *
 * @param axis Local axis index.
 * @returns Negative face enum.
 */
function negativeFaceForAxis(axis: CadLocalAxis): BoundsFace {
  if (axis === 0) return BoundsFace.NEG_X;
  if (axis === 1) return BoundsFace.NEG_Y;
  return BoundsFace.NEG_Z;
}
