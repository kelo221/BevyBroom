import * as THREE from 'three';
import type { DataOrientedBounds } from './builder_oriented_bounds.js';
import type { GizmoHandleHitAcceptance } from '@/transform/gizmo/gizmo_raycaster.js';

/** Distance a handle hit must lie beyond the bounds entry to count as hidden. */
const BOUNDS_HANDLE_OCCLUSION_EPSILON = 1e-6;

/**
 * Returns how far along a ray it enters an oriented box.
 *
 * @param ray World ray with a unit direction (not modified).
 * @param bounds Oriented box.
 * @returns Entry distance from the ray origin, or null when the ray misses the
 *   box or starts inside it.
 */
export function boundsRayEntryDistance(ray: THREE.Ray, bounds: DataOrientedBounds): number | null {
  const toLocal = bounds.quaternion.clone().invert();
  const localOrigin = ray.origin.clone().sub(bounds.center).applyQuaternion(toLocal);
  const localDirection = ray.direction.clone().applyQuaternion(toLocal);
  const localBox = new THREE.Box3(bounds.halfExtents.clone().negate(), bounds.halfExtents.clone());
  if (localBox.containsPoint(localOrigin)) {
    return null;
  }
  const entry = new THREE.Ray(localOrigin, localDirection).intersectBox(localBox, new THREE.Vector3());
  return entry ? entry.distanceTo(localOrigin) : null;
}

/**
 * Returns whether a handle hit lies behind the selection box, so the box hides
 * it from the viewer along the pick ray.
 *
 * @param hit Ray hit on a handle mesh.
 * @param ray World pick ray the hit lies on.
 * @param bounds Selection bounds.
 * @returns True when the ray enters the box before reaching the hit.
 */
export function boundsHandleHitHiddenBehindSelection(
  hit: THREE.Intersection,
  ray: THREE.Ray,
  bounds: DataOrientedBounds,
): boolean {
  const entryDistance = boundsRayEntryDistance(ray, bounds);
  return entryDistance !== null && entryDistance + BOUNDS_HANDLE_OCCLUSION_EPSILON < hit.distance;
}

/**
 * Builds a handle hit test that keeps only handles not hidden behind the
 * selection box.
 *
 * @param bounds Selection bounds.
 * @returns Hit acceptance for gizmo handle picking.
 */
export function boundsHandleVisibleHitAcceptanceCreate(bounds: DataOrientedBounds): GizmoHandleHitAcceptance {
  return (hit, ray) => !boundsHandleHitHiddenBehindSelection(hit, ray, bounds);
}
