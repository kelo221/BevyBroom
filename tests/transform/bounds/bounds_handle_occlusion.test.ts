import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  boundsHandleHitHiddenBehindSelection,
  boundsHandleVisibleHitAcceptanceCreate,
  boundsRayEntryDistance,
} from '@/transform/bounds/bounds_handle_occlusion.js';
import type { DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';

/**
 * Creates turned and moved oriented bounds.
 *
 * @returns Oriented bounds.
 */
function orientedBoundsCreate(): DataOrientedBounds {
  return {
    center: new THREE.Vector3(2, 1, -3),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.9, -0.1)),
    halfExtents: new THREE.Vector3(1.5, 0.5, 2),
  };
}

/**
 * Returns a world point on the outside of a bounds face center.
 *
 * @param bounds Oriented bounds.
 * @param localNormal Local face normal.
 * @param outsideDistance Distance beyond the face.
 * @returns World point.
 */
function pointBeyondFace(
  bounds: DataOrientedBounds,
  localNormal: THREE.Vector3,
  outsideDistance: number,
): THREE.Vector3 {
  const localPoint = localNormal.clone().multiply(bounds.halfExtents).addScaledVector(localNormal, outsideDistance);
  return localPoint.applyQuaternion(bounds.quaternion).add(bounds.center);
}

/**
 * Builds a ray from an origin through a target.
 *
 * @param origin Ray origin.
 * @param target Point the ray passes through.
 * @returns Ray with a unit direction.
 */
function rayThrough(origin: THREE.Vector3, target: THREE.Vector3): THREE.Ray {
  return new THREE.Ray(origin.clone(), target.clone().sub(origin).normalize());
}

/**
 * Builds a ray hit at a point on a ray.
 *
 * @param ray Ray.
 * @param point Hit point on the ray.
 * @returns Intersection record.
 */
function hitAt(ray: THREE.Ray, point: THREE.Vector3): THREE.Intersection {
  return { distance: ray.origin.distanceTo(point), point: point.clone(), object: new THREE.Object3D() };
}

/**
 * Proves hidden bounds handles are told apart from visible ones: a handle hit
 * the ray reaches only after entering the selection box is hidden behind it.
 */
describe('bounds handle occlusion', () => {
  const bounds = orientedBoundsCreate();
  const up = new THREE.Vector3(0, 1, 0);
  const eye = pointBeyondFace(bounds, up, 10).add(new THREE.Vector3(3, 0, 2));

  it('measures where a ray enters turned bounds', () => {
    const topCenter = pointBeyondFace(bounds, up, 0);
    const ray = rayThrough(eye, bounds.center);
    const entry = boundsRayEntryDistance(ray, bounds);
    expect(entry).not.toBeNull();
    expect(entry ?? 0).toBeLessThan(eye.distanceTo(bounds.center));
    expect(boundsRayEntryDistance(rayThrough(eye, topCenter), bounds)).toBeCloseTo(eye.distanceTo(topCenter), 6);
  });

  it('reports no entry for rays that miss the bounds or start inside them', () => {
    const away = new THREE.Ray(eye.clone(), eye.clone().sub(bounds.center).normalize());
    expect(boundsRayEntryDistance(away, bounds)).toBeNull();
    expect(boundsRayEntryDistance(rayThrough(bounds.center, eye), bounds)).toBeNull();
  });

  it('hides a handle beyond the far face and keeps one in front of the near face', () => {
    const farHandle = pointBeyondFace(bounds, up.clone().negate(), 0.1);
    const farRay = rayThrough(eye, farHandle);
    expect(boundsHandleHitHiddenBehindSelection(hitAt(farRay, farHandle), farRay, bounds)).toBe(true);
    const nearHandle = pointBeyondFace(bounds, up, 0.1);
    const nearRay = rayThrough(eye, nearHandle);
    expect(boundsHandleHitHiddenBehindSelection(hitAt(nearRay, nearHandle), nearRay, bounds)).toBe(false);
  });

  it('accepts only visible hits through the acceptance test', () => {
    const isAccepted = boundsHandleVisibleHitAcceptanceCreate(bounds);
    const farHandle = pointBeyondFace(bounds, up.clone().negate(), 0.1);
    const farRay = rayThrough(eye, farHandle);
    expect(isAccepted(hitAt(farRay, farHandle), farRay)).toBe(false);
    const nearHandle = pointBeyondFace(bounds, up, 0.1);
    const nearRay = rayThrough(eye, nearHandle);
    expect(isAccepted(hitAt(nearRay, nearHandle), nearRay)).toBe(true);
  });
});
