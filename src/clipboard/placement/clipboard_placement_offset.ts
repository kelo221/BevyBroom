import * as THREE from 'three';

/** Surface point and normal found under the cursor in a 3D view. */
export interface ClipboardPlacementSurfaceHit {
  /** World-space hit point. */
  readonly point: THREE.Vector3;
  /** World-space surface normal; flipped to face the ray when needed. */
  readonly normal: THREE.Vector3;
}

/** Inputs of a paste placed through a 3D view. */
export interface ClipboardPlacement3dInput {
  /** World bounds of the content at its copied position. */
  readonly bounds: THREE.Box3;
  /** World ray through the cursor. */
  readonly ray: THREE.Ray;
  /** Nearest surface under the cursor, or null when the ray hits nothing. */
  readonly surfaceHit: ClipboardPlacementSurfaceHit | null;
  /** Working grid plane used when no surface is hit. */
  readonly workingPlane: THREE.Plane;
  /** Farthest working plane hit that is still used. */
  readonly workingPlaneMaxDistance: number;
  /** Distance along the ray used when neither surface nor plane is hit. */
  readonly fallbackDistance: number;
  /** Grid step the offset snaps to; zero or less disables snapping. */
  readonly gridInterval: number;
}

/** Inputs of a paste placed through a 2D view. */
export interface ClipboardPlacement2dInput {
  /** World bounds of the content at its copied position. */
  readonly bounds: THREE.Box3;
  /** World point under the cursor. */
  readonly cursorPoint: THREE.Vector3;
  /** Direction the 2D view looks along. */
  readonly viewDirection: THREE.Vector3;
  /** Grid step the offset snaps to; zero or less disables snapping. */
  readonly gridInterval: number;
}

/**
 * Computes the offset that moves content to the cursor of a 3D view. On a
 * surface or the working plane the bounds rest against it with their center
 * over the hit point; otherwise the center goes a fixed distance along the ray.
 * The offset snaps to the grid except along the axis the content rests on, so
 * grid-aligned content stays aligned and keeps touching the surface.
 *
 * @param input Bounds, cursor ray, hits and grid.
 * @returns World-space offset to add to the content.
 */
export function clipboardPlacementOffset3dCompute(input: ClipboardPlacement3dInput): THREE.Vector3 {
  const restingHit = input.surfaceHit ?? clipboardPlacementWorkingPlaneHit(input);
  if (restingHit === null) {
    const target = input.ray.at(input.fallbackDistance, new THREE.Vector3());
    const offset = target.sub(input.bounds.getCenter(new THREE.Vector3()));
    return clipboardPlacementOffsetSnap(offset, input.gridInterval, null);
  }
  const normal = clipboardPlacementNormalFacingRay(restingHit.normal, input.ray);
  const restingDistance = clipboardPlacementRestingDistance(input.bounds, normal);
  const target = restingHit.point.clone().addScaledVector(normal, restingDistance);
  const offset = target.sub(input.bounds.getCenter(new THREE.Vector3()));
  return clipboardPlacementOffsetSnap(offset, input.gridInterval, clipboardPlacementDominantAxis(normal));
}

/**
 * Computes the offset that moves content under the cursor of a 2D view while
 * keeping its depth along the view direction.
 *
 * @param input Bounds, cursor point, view direction and grid.
 * @returns World-space offset to add to the content.
 */
export function clipboardPlacementOffset2dCompute(input: ClipboardPlacement2dInput): THREE.Vector3 {
  const offset = input.cursorPoint.clone().sub(input.bounds.getCenter(new THREE.Vector3()));
  const depthAxis = clipboardPlacementDominantAxis(input.viewDirection);
  const snapped = clipboardPlacementOffsetSnap(offset, input.gridInterval, null);
  snapped.setComponent(depthAxis, 0);
  return snapped;
}

/**
 * Intersects the cursor ray with the working plane within range.
 *
 * @param input 3D placement inputs.
 * @returns Plane hit with the plane normal, or null when out of range.
 */
function clipboardPlacementWorkingPlaneHit(input: ClipboardPlacement3dInput): ClipboardPlacementSurfaceHit | null {
  const point = input.ray.intersectPlane(input.workingPlane, new THREE.Vector3());
  if (point === null || point.distanceTo(input.ray.origin) > input.workingPlaneMaxDistance) {
    return null;
  }
  return { point, normal: input.workingPlane.normal.clone() };
}

/**
 * Returns how far the bounds center must sit from a surface along its normal so
 * the bounds just touch the surface.
 *
 * @param bounds Content bounds.
 * @param normal Unit surface normal.
 * @returns Distance from the surface to the bounds center.
 */
function clipboardPlacementRestingDistance(bounds: THREE.Box3, normal: THREE.Vector3): number {
  const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return Math.abs(normal.x) * halfSize.x + Math.abs(normal.y) * halfSize.y + Math.abs(normal.z) * halfSize.z;
}

/**
 * Returns a unit normal that points back toward the ray origin.
 *
 * @param normal Surface normal.
 * @param ray Cursor ray.
 * @returns Normalized copy facing the ray.
 */
function clipboardPlacementNormalFacingRay(normal: THREE.Vector3, ray: THREE.Ray): THREE.Vector3 {
  const facing = normal.clone().normalize();
  return facing.dot(ray.direction) > 0 ? facing.negate() : facing;
}

/**
 * Returns the axis index with the largest absolute component.
 *
 * @param direction Direction to inspect.
 * @returns 0 for x, 1 for y, 2 for z.
 */
function clipboardPlacementDominantAxis(direction: THREE.Vector3): number {
  const absolute = [Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)];
  const largest = Math.max(...absolute);
  return absolute.indexOf(largest);
}

/**
 * Rounds offset components to whole grid steps.
 *
 * @param offset Offset changed in place.
 * @param gridInterval Grid step; zero or less leaves the offset unchanged.
 * @param exactAxis Axis left unsnapped, or null to snap every axis.
 * @returns The same offset.
 */
function clipboardPlacementOffsetSnap(
  offset: THREE.Vector3,
  gridInterval: number,
  exactAxis: number | null,
): THREE.Vector3 {
  if (!(gridInterval > 0)) {
    return offset;
  }
  for (let axis = 0; axis < 3; axis++) {
    if (axis !== exactAxis) {
      offset.setComponent(axis, Math.round(offset.getComponent(axis) / gridInterval) * gridInterval);
    }
  }
  return offset;
}
