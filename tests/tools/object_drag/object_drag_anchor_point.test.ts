import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPAWN_DISTANCE } from '@/navigation/placement/object_spawn_placement.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { objectDragAnchorPointResolve } from '@/tools/object_drag/object_drag_anchor_point.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  objectDragTestBoxMeshCreate,
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
} from './object_drag_test_viewport.js';

/**
 * Proves the point under the pointer resolves to the nearest surface, else the
 * grid plane in front of the camera, else a point at the spawn distance.
 */
describe('objectDragAnchorPointResolve', () => {
  it('uses the nearest surface and its normal facing the viewer', () => {
    const world = new THREE.Group();
    const size = new THREE.Vector3(4, 2, 4);
    const mesh = objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(0.5, 1.5, -0.5));
    const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE, [mesh]);
    const topPoint = new THREE.Vector3(0.9, new THREE.Box3().setFromObject(mesh).max.y, -0.2);
    const pointer = objectDragTestClientPoint(testViewport, topPoint);
    const frame = new ObjectDragGridFrame(new GridSnap(true, 1));
    const anchor = objectDragAnchorPointResolve(testViewport.viewport, frame, pointer.clientX, pointer.clientY);
    expect(anchor.source).toBe('surface');
    expect(anchor.point.distanceTo(topPoint)).toBeLessThan(1e-4);
    expect(anchor.awayDirection.y).toBeCloseTo(1, 6);
  });

  it('falls back to the grid plane with the normal on the camera side', () => {
    const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE);
    const groundPoint = new THREE.Vector3(-2, 0, 1.5);
    const pointer = objectDragTestClientPoint(testViewport, groundPoint);
    const frame = new ObjectDragGridFrame(new GridSnap(true, 1));
    const anchor = objectDragAnchorPointResolve(testViewport.viewport, frame, pointer.clientX, pointer.clientY);
    expect(anchor.source).toBe('grid');
    expect(anchor.point.distanceTo(groundPoint)).toBeLessThan(1e-4);
    expect(anchor.awayDirection.dot(testViewport.camera.position)).toBeGreaterThan(0);
  });

  it('places the point at the spawn distance when the grid plane is behind the camera', () => {
    const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE);
    const camera = testViewport.camera;
    const skyPoint = camera.position
      .clone()
      .add(new THREE.Vector3(0, 5, 0))
      .sub(camera.position.clone().multiplyScalar(0.2));
    const pointer = objectDragTestClientPoint(testViewport, skyPoint);
    const frame = new ObjectDragGridFrame(new GridSnap(true, 1));
    const anchor = objectDragAnchorPointResolve(testViewport.viewport, frame, pointer.clientX, pointer.clientY);
    expect(anchor.source).toBe('fallback');
    expect(anchor.point.distanceTo(camera.position)).toBeCloseTo(DEFAULT_SPAWN_DISTANCE, 3);
  });
});
