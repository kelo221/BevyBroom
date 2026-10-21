import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';

/**
 * Creates a grid snap whose working plane is turned and moved.
 *
 * @param rotation Rotation applied to the default grid axes.
 * @param origin Grid plane origin.
 * @param interval Grid step.
 * @returns Grid snap.
 */
function gridSnapTiltedCreate(rotation: THREE.Quaternion, origin: THREE.Vector3, interval: number): GridSnap {
  const gridSnap = new GridSnap(true, interval);
  gridSnap.setPlaneFrame({
    origin: origin.clone(),
    uAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(rotation),
    normal: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
    vAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(rotation),
  });
  return gridSnap;
}

/** Proves the grid frame maps between world space and grid-local coordinates. */
describe('ObjectDragGridFrame', () => {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -0.7, 0.2));
  const origin = new THREE.Vector3(3, -1, 2);

  it('round-trips positions and vectors through grid-local space', () => {
    const frame = new ObjectDragGridFrame(gridSnapTiltedCreate(rotation, origin, 0.25));
    const worldPosition = new THREE.Vector3(-4, 7, 1.5);
    const worldVector = new THREE.Vector3(0.5, -2, 3);
    expect(frame.positionToWorld(frame.positionToLocal(worldPosition)).distanceTo(worldPosition)).toBeLessThan(1e-9);
    expect(frame.vectorToWorld(frame.vectorToLocal(worldVector)).distanceTo(worldVector)).toBeLessThan(1e-9);
  });

  it('measures local Y along the grid normal from the grid origin', () => {
    const frame = new ObjectDragGridFrame(gridSnapTiltedCreate(rotation, origin, 0.25));
    const height = 2.75;
    const local = frame.positionToLocal(origin.clone().addScaledVector(frame.normalWorld(), height));
    expect(local.y).toBeCloseTo(height, 9);
    expect(Math.hypot(local.x, local.z)).toBeLessThan(1e-9);
  });

  it('orients local axes onto the grid axes', () => {
    const frame = new ObjectDragGridFrame(gridSnapTiltedCreate(rotation, origin, 0.25));
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(frame.orientationWorld());
    expect(localUp.distanceTo(frame.normalWorld())).toBeLessThan(1e-9);
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(frame.orientationWorld());
    expect(localX.distanceTo(frame.vectorToWorld(new THREE.Vector3(1, 0, 0)))).toBeLessThan(1e-9);
  });

  it('does not modify its inputs', () => {
    const frame = new ObjectDragGridFrame(gridSnapTiltedCreate(rotation, origin, 0.25));
    const input = new THREE.Vector3(1, 2, 3);
    const copy = input.clone();
    frame.positionToLocal(input);
    frame.positionToWorld(input);
    frame.vectorToLocal(input);
    frame.vectorToWorld(input);
    expect(input.equals(copy)).toBe(true);
  });

  it('reports the grid step and never a zero step', () => {
    const interval = 0.125;
    expect(new ObjectDragGridFrame(new GridSnap(true, interval)).gridStep()).toBe(interval);
    expect(new ObjectDragGridFrame(new GridSnap(true, 0)).gridStep()).toBeGreaterThan(0);
  });
});
