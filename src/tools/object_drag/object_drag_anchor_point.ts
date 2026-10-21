import * as THREE from 'three';
import { DEFAULT_SPAWN_DISTANCE } from '@/navigation/placement/object_spawn_placement.js';
import { objectDragRayPlaneIntersect } from './object_drag_ray_math.js';
import type { ObjectDragGridFrame } from './object_drag_grid_frame.js';
import type { ObjectDragViewport } from './object_drag_viewport.js';

/** Where an anchor point under the pointer came from. */
export type ObjectDragAnchorSource = 'surface' | 'grid' | 'fallback';

/** World point under the pointer plus the side of it that faces the viewer. */
export interface ObjectDragAnchorPoint {
  /** World anchor position. */
  point: THREE.Vector3;
  /** Unit world direction pointing from the anchor toward the viewer side. */
  awayDirection: THREE.Vector3;
  /** Which resolution step produced the point. */
  source: ObjectDragAnchorSource;
}

/**
 * Resolves the world point under the pointer: the nearest surface hit, else the
 * working grid plane in front of the camera, else a point at the default spawn
 * distance along the pick ray.
 *
 * @param viewport Viewport wrapper under the pointer.
 * @param gridFrame Working grid frame.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param candidateMeshes Meshes eligible for the surface hit; the pane's
 *   selectable meshes when omitted.
 * @returns Anchor point.
 */
export function objectDragAnchorPointResolve(
  viewport: ObjectDragViewport,
  gridFrame: ObjectDragGridFrame,
  clientX: number,
  clientY: number,
  candidateMeshes?: readonly THREE.Mesh[],
): ObjectDragAnchorPoint {
  const surfaceHit = viewport.surfaceHitAtClientPoint(clientX, clientY, candidateMeshes);
  if (surfaceHit) {
    return { point: surfaceHit.point, awayDirection: surfaceHit.normal, source: 'surface' };
  }
  const ray = viewport.rayAtClientPoint(clientX, clientY);
  return objectDragAnchorOnGridPlane(ray, gridFrame) ?? objectDragAnchorAtSpawnDistance(ray);
}

/**
 * Intersects the pick ray with the working grid plane in front of the camera.
 *
 * @param ray World pick ray.
 * @param gridFrame Working grid frame.
 * @returns Anchor on the grid plane, or null when the plane is behind or
 *   parallel.
 */
export function objectDragAnchorOnGridPlane(
  ray: THREE.Ray,
  gridFrame: ObjectDragGridFrame,
): ObjectDragAnchorPoint | null {
  const gridNormal = gridFrame.normalWorld();
  const point = objectDragRayPlaneIntersect(ray, gridFrame.originWorld(), gridNormal);
  if (!point || point.clone().sub(ray.origin).dot(ray.direction) <= 0) {
    return null;
  }
  const viewerSideSign = ray.origin.clone().sub(point).dot(gridNormal) >= 0 ? 1 : -1;
  return { point, awayDirection: gridNormal.multiplyScalar(viewerSideSign), source: 'grid' };
}

/**
 * Places an anchor at the default spawn distance along the pick ray.
 *
 * @param ray World pick ray.
 * @returns Anchor facing back toward the camera.
 */
export function objectDragAnchorAtSpawnDistance(ray: THREE.Ray): ObjectDragAnchorPoint {
  return {
    point: ray.at(DEFAULT_SPAWN_DISTANCE, new THREE.Vector3()),
    awayDirection: ray.direction.clone().negate(),
    source: 'fallback',
  };
}
