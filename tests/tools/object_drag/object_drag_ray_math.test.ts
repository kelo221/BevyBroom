import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  objectDragRayLineClosestParameter,
  objectDragRayPlaneIntersect,
} from '@/tools/object_drag/object_drag_ray_math.js';

/**
 * Builds a ray from an origin through a target point.
 *
 * @param origin Ray origin.
 * @param target Point the ray passes through.
 * @returns Ray with a unit direction.
 */
function rayThrough(origin: THREE.Vector3, target: THREE.Vector3): THREE.Ray {
  return new THREE.Ray(origin.clone(), target.clone().sub(origin).normalize());
}

/** Proves the ray-plane and ray-line projections object drags rely on. */
describe('object drag ray math', () => {
  it('finds the plane point a ray was aimed at, for any plane orientation', () => {
    const planeNormal = new THREE.Vector3(0.3, 1, -0.4).normalize();
    const planePoint = new THREE.Vector3(2, -1, 3);
    const tangent = new THREE.Vector3(1, 0, 0).cross(planeNormal).normalize();
    const target = planePoint.clone().addScaledVector(tangent, 4.5);
    const hit = objectDragRayPlaneIntersect(rayThrough(new THREE.Vector3(-5, 9, 7), target), planePoint, planeNormal);
    expect(hit?.distanceTo(target)).toBeLessThan(1e-9);
  });

  it('accepts plane hits behind the ray origin', () => {
    const origin = new THREE.Vector3(1, 2, 3);
    const ray = new THREE.Ray(origin.clone(), new THREE.Vector3(0, 1, 0));
    const hit = objectDragRayPlaneIntersect(ray, new THREE.Vector3(0, -4, 0), new THREE.Vector3(0, 1, 0));
    expect(hit?.y).toBeCloseTo(-4, 9);
    expect(hit?.x).toBeCloseTo(origin.x, 9);
  });

  it('returns null for a ray parallel to the plane', () => {
    const ray = new THREE.Ray(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
    expect(objectDragRayPlaneIntersect(ray, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).toBeNull();
  });

  it('finds the line parameter of the point a ray was aimed at', () => {
    const linePoint = new THREE.Vector3(1, -2, 4);
    const lineDirection = new THREE.Vector3(0, 1, 0);
    const parameter = 3.7;
    const target = linePoint.clone().addScaledVector(lineDirection, parameter);
    const ray = rayThrough(new THREE.Vector3(9, 6, -3), target);
    expect(objectDragRayLineClosestParameter(ray, linePoint, lineDirection)).toBeCloseTo(parameter, 9);
  });

  it('returns null for a ray parallel to the line', () => {
    const ray = new THREE.Ray(new THREE.Vector3(5, 0, 0), new THREE.Vector3(0, 1, 0));
    expect(objectDragRayLineClosestParameter(ray, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).toBeNull();
  });
});
