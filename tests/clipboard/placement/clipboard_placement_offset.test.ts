import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  clipboardPlacementOffset2dCompute,
  clipboardPlacementOffset3dCompute,
  type ClipboardPlacement3dInput,
} from '@/clipboard/placement/clipboard_placement_offset.js';

/**
 * Builds 3D placement inputs for content bounds and a ray, with the ground
 * plane as the working plane.
 *
 * @param bounds Content bounds.
 * @param ray Cursor ray.
 * @param overrides Inputs replacing the defaults.
 * @returns Placement inputs.
 */
function input3dCreate(
  bounds: THREE.Box3,
  ray: THREE.Ray,
  overrides: Partial<ClipboardPlacement3dInput> = {},
): ClipboardPlacement3dInput {
  return {
    bounds,
    ray,
    surfaceHit: null,
    workingPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    workingPlaneMaxDistance: 1000,
    fallbackDistance: 8,
    gridInterval: 0,
    ...overrides,
  };
}

/**
 * Returns a ray from a point toward a target.
 *
 * @param origin Ray start.
 * @param target Point the ray passes through.
 * @returns Ray.
 */
function rayToward(origin: THREE.Vector3, target: THREE.Vector3): THREE.Ray {
  return new THREE.Ray(origin.clone(), target.clone().sub(origin).normalize());
}

/** Pure placement math of pastes under the pointer. */
describe('clipboard placement offset', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-1, 5, -2), new THREE.Vector3(3, 7, 2));

  it('rests the bounds on a hit surface with the center over the hit point', () => {
    const hitPoint = new THREE.Vector3(10, 4, -6);
    const ray = rayToward(new THREE.Vector3(10, 20, -6), hitPoint);
    const surfaceHit = { point: hitPoint, normal: new THREE.Vector3(0, 1, 0) };
    const moved = bounds
      .clone()
      .translate(clipboardPlacementOffset3dCompute(input3dCreate(bounds, ray, { surfaceHit })));
    expect(moved.min.y).toBeCloseTo(hitPoint.y, 6);
    const center = moved.getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(hitPoint.x, 6);
    expect(center.z).toBeCloseTo(hitPoint.z, 6);
  });

  it('rests the bounds against a wall facing the ray even when the normal points away', () => {
    const hitPoint = new THREE.Vector3(5, 1, 0);
    const ray = rayToward(new THREE.Vector3(-5, 1, 0), hitPoint);
    const surfaceHit = { point: hitPoint, normal: new THREE.Vector3(1, 0, 0) };
    const moved = bounds
      .clone()
      .translate(clipboardPlacementOffset3dCompute(input3dCreate(bounds, ray, { surfaceHit })));
    expect(moved.max.x).toBeCloseTo(hitPoint.x, 6);
  });

  it('rests the bounds on the working plane when no surface is hit and snaps across it', () => {
    const planeTarget = new THREE.Vector3(4.3, 0, -2.6);
    const ray = rayToward(new THREE.Vector3(0, 10, 0), planeTarget);
    const gridInterval = 0.5;
    const offset = clipboardPlacementOffset3dCompute(input3dCreate(bounds, ray, { gridInterval }));
    const moved = bounds.clone().translate(offset);
    expect(moved.min.y).toBeCloseTo(0, 6);
    expect(offset.x / gridInterval).toBeCloseTo(Math.round(offset.x / gridInterval), 6);
    expect(offset.z / gridInterval).toBeCloseTo(Math.round(offset.z / gridInterval), 6);
    expect(Math.abs(moved.getCenter(new THREE.Vector3()).x - planeTarget.x)).toBeLessThanOrEqual(gridInterval / 2);
  });

  it('puts the center a fixed distance along the ray when nothing is hit', () => {
    const ray = rayToward(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 3, -10));
    const fallbackDistance = 12;
    const offset = clipboardPlacementOffset3dCompute(input3dCreate(bounds, ray, { fallbackDistance }));
    const center = bounds.clone().translate(offset).getCenter(new THREE.Vector3());
    expect(center.distanceTo(ray.at(fallbackDistance, new THREE.Vector3()))).toBeLessThan(1e-6);
  });

  it('ignores working plane hits beyond the maximum distance', () => {
    const ray = rayToward(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1000, 0, 0));
    const offset = clipboardPlacementOffset3dCompute(input3dCreate(bounds, ray, { workingPlaneMaxDistance: 50 }));
    const center = bounds.clone().translate(offset).getCenter(new THREE.Vector3());
    expect(center.distanceTo(ray.at(8, new THREE.Vector3()))).toBeLessThan(1e-6);
  });

  it('moves content under the cursor of a 2D view without changing its depth', () => {
    const cursorPoint = new THREE.Vector3(9.2, 50, 3.9);
    const gridInterval = 1;
    const offset = clipboardPlacementOffset2dCompute({
      bounds,
      cursorPoint,
      viewDirection: new THREE.Vector3(0, -1, 0),
      gridInterval,
    });
    expect(offset.y).toBe(0);
    expect(Number.isInteger(offset.x / gridInterval)).toBe(true);
    expect(Number.isInteger(offset.z / gridInterval)).toBe(true);
    const center = bounds.clone().translate(offset).getCenter(new THREE.Vector3());
    expect(Math.abs(center.x - cursorPoint.x)).toBeLessThanOrEqual(gridInterval / 2);
    expect(Math.abs(center.z - cursorPoint.z)).toBeLessThanOrEqual(gridInterval / 2);
  });
});
