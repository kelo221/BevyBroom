import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  offsetSignScreenTopOrLeftPick,
  placeCameraFacingMeasuredEdge,
} from '@/rulers/dimension/cad_dimension_edge_placement.js';
import type { DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import type { LocalAxisIndex } from '@/rulers/dimension/cad_dimension_types.js';

/**
 * Creates an orthographic camera looking at a point along a view direction.
 *
 * @param target Point the camera looks at.
 * @param viewDirection Direction the camera looks along.
 * @param up Screen-up direction.
 * @returns Camera with an up-to-date world matrix.
 */
function orthoCameraCreate(target: THREE.Vector3, viewDirection: THREE.Vector3, up: THREE.Vector3): THREE.Camera {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  camera.position.copy(target).addScaledVector(viewDirection, -50);
  camera.up.copy(up);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Projects the measured edge midpoint and the box center to screen space.
 *
 * @param bounds Box being measured.
 * @param measureLocal Measured local axis.
 * @param camera Pane camera.
 * @param viewPlane Pane view plane.
 * @returns Screen-space offset of the edge midpoint from the box center.
 */
function measuredEdgeScreenOffset(
  bounds: DataOrientedBounds,
  measureLocal: LocalAxisIndex,
  camera: THREE.Camera,
  viewPlane: CadViewPlane,
): THREE.Vector2 {
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const outward = new THREE.Vector3();
  placeCameraFacingMeasuredEdge(bounds, measureLocal, camera, start, end, outward, viewPlane);
  const middle = start.lerp(end, 0.5).project(camera);
  const center = bounds.center.clone().project(camera);
  return new THREE.Vector2(middle.x - center.x, middle.y - center.y);
}

/**
 * Hammer places a 2D selection's width above its top edge and its height left
 * of its left edge.
 */
describe('cad dimension edge placement in 2D panes', () => {
  const bounds: DataOrientedBounds = {
    center: new THREE.Vector3(2, 1, -3),
    quaternion: new THREE.Quaternion(),
    halfExtents: new THREE.Vector3(1.5, 0.5, 2),
  };

  it('measures the top-view width on the top edge and the height on the left edge', () => {
    const camera = orthoCameraCreate(bounds.center, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1));
    const widthOffset = measuredEdgeScreenOffset(bounds, 0, camera, 'xz');
    const heightOffset = measuredEdgeScreenOffset(bounds, 2, camera, 'xz');
    expect(widthOffset.y).toBeGreaterThan(0);
    expect(Math.abs(widthOffset.x)).toBeLessThan(1e-6);
    expect(heightOffset.x).toBeLessThan(0);
    expect(Math.abs(heightOffset.y)).toBeLessThan(1e-6);
  });

  it('measures the front-view width on the top edge and the height on the left edge', () => {
    const camera = orthoCameraCreate(bounds.center, new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
    expect(measuredEdgeScreenOffset(bounds, 0, camera, 'xy').y).toBeGreaterThan(0);
    expect(measuredEdgeScreenOffset(bounds, 1, camera, 'xy').x).toBeLessThan(0);
  });

  it('measures the side-view width on the top edge and the height on the left edge', () => {
    const camera = orthoCameraCreate(bounds.center, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
    expect(measuredEdgeScreenOffset(bounds, 2, camera, 'yz').y).toBeGreaterThan(0);
    expect(measuredEdgeScreenOffset(bounds, 1, camera, 'yz').x).toBeLessThan(0);
  });

  it('picks the offset sign toward screen top for horizontal sizes and screen left for vertical sizes', () => {
    const camera = orthoCameraCreate(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    expect(offsetSignScreenTopOrLeftPick(right, up, camera)).toBe(1);
    expect(offsetSignScreenTopOrLeftPick(right, up.clone().negate(), camera)).toBe(-1);
    expect(offsetSignScreenTopOrLeftPick(up, right, camera)).toBe(-1);
    expect(offsetSignScreenTopOrLeftPick(up, right.clone().negate(), camera)).toBe(1);
  });
});
