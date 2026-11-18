import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { componentDragDeltaSnap } from '@/edit/transform/drag/component_drag_grid_snap.js';
import type { ComponentDragSurface } from '@/edit/transform/drag/component_drag_surface.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';

/** Grid step used by every case. */
const GRID_STEP = 0.25;

/** Horizontal drag plane through the origin. */
const GRID_PLANE: ComponentDragSurface = {
  kind: 'plane',
  plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
};

/**
 * Returns whether a value lies on the test grid.
 *
 * @param value Coordinate.
 * @returns True on a grid line.
 */
function onTestGrid(value: number): boolean {
  return Math.abs(value / GRID_STEP - Math.round(value / GRID_STEP)) < 1e-9;
}

/**
 * Proves dragged components land on grid lines rather than keep their off-grid
 * offset.
 */
describe('componentDragDeltaSnap', () => {
  it('lands an off-grid anchor on the nearest grid line of every moved axis', () => {
    const anchor = new THREE.Vector3(GRID_STEP * 0.4, 0.3, -GRID_STEP * 0.3);
    const delta = new THREE.Vector3(GRID_STEP * 3.3, 0, GRID_STEP * 2.2);
    const snapped = componentDragDeltaSnap(delta, anchor, GRID_PLANE, new GridSnap(true, GRID_STEP));
    const landed = anchor.clone().add(snapped);
    expect(onTestGrid(landed.x)).toBe(true);
    expect(onTestGrid(landed.z)).toBe(true);
    expect(landed.y).toBe(anchor.y);
    expect(Math.abs(landed.x - (anchor.x + delta.x))).toBeLessThanOrEqual(GRID_STEP / 2);
  });

  it('leaves an axis the drag did not move where it was', () => {
    const anchor = new THREE.Vector3(0.1, 0, 0.1);
    const snapped = componentDragDeltaSnap(
      new THREE.Vector3(1, 0, 0),
      anchor,
      GRID_PLANE,
      new GridSnap(true, GRID_STEP),
    );
    expect(snapped.z).toBe(0);
  });

  it('snaps the travel distance along a slanted line', () => {
    const direction = new THREE.Vector3(1, 1, 0).normalize();
    const line: ComponentDragSurface = { kind: 'line', origin: new THREE.Vector3(), direction };
    const delta = direction.clone().multiplyScalar(GRID_STEP * 2.4);
    const snapped = componentDragDeltaSnap(delta, new THREE.Vector3(), line, new GridSnap(true, GRID_STEP));
    expect(snapped.length()).toBeCloseTo(GRID_STEP * 2, 9);
    expect(snapped.clone().normalize().dot(direction)).toBeCloseTo(1, 9);
  });

  it('changes nothing while snapping is off', () => {
    const delta = new THREE.Vector3(0.123, 0, 0.456);
    const snapped = componentDragDeltaSnap(
      delta,
      new THREE.Vector3(0.1, 0, 0),
      GRID_PLANE,
      new GridSnap(false, GRID_STEP),
    );
    expect(snapped.equals(delta)).toBe(true);
  });
});
