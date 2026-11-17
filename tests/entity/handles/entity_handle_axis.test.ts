import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  entityHandleAxisColorOf,
  entityHandleAxisDragPlane,
  entityHandleAxisPointOf,
  entityHandleWorldAxes,
} from '@/entity/handles/entity_handle_axis.js';
import { Theme } from '@/theme.js';

/** Arrow drags keep a handle on its axis line and colour arrows by world axis. */
describe('entity handle axis math', () => {
  const origin = new THREE.Vector3(2, -1, 4);

  it('builds a drag plane that holds the axis line and faces the camera side', () => {
    const axis = new THREE.Vector3(1, 1, 0).normalize();
    const viewDirection = new THREE.Vector3(0.2, -0.3, -1).normalize();
    const plane = entityHandleAxisDragPlane(origin, axis, viewDirection);
    expect(plane.distanceToPoint(origin)).toBeCloseTo(0, 9);
    expect(plane.distanceToPoint(origin.clone().addScaledVector(axis, 7.5))).toBeCloseTo(0, 9);
    expect(Math.abs(plane.normal.dot(axis))).toBeLessThan(1e-9);
    expect(Math.abs(plane.normal.dot(viewDirection))).toBeGreaterThan(0.5);
  });

  it('still returns a plane through the origin when looking straight down the axis', () => {
    const axis = new THREE.Vector3(0, 0, 1);
    const plane = entityHandleAxisDragPlane(origin, axis, axis.clone().negate());
    expect(plane.distanceToPoint(origin)).toBeCloseTo(0, 9);
    expect(plane.normal.length()).toBeCloseTo(1, 9);
  });

  it('projects any point onto the axis line', () => {
    const axis = new THREE.Vector3(0, 1, 0);
    const projected = entityHandleAxisPointOf(origin, axis, new THREE.Vector3(9, 3.5, -7));
    expect(projected.toArray()).toEqual([origin.x, 3.5, origin.z]);
  });

  it('colours arrows red, green and blue by the world axis they run closest to', () => {
    const [x, y, z] = entityHandleWorldAxes();
    expect(entityHandleAxisColorOf(x ?? new THREE.Vector3())).toBe(Theme.gizmoXAxisColor);
    expect(entityHandleAxisColorOf(y ?? new THREE.Vector3())).toBe(Theme.gizmoYAxisColor);
    expect(entityHandleAxisColorOf(z ?? new THREE.Vector3())).toBe(Theme.gizmoZAxisColor);
    expect(entityHandleAxisColorOf(new THREE.Vector3(-0.2, 0.1, -0.9))).toBe(Theme.gizmoZAxisColor);
  });
});
