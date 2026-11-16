import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT,
  ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MAX,
  ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MIN,
  EntityBrowserPreviewOrbit,
} from '@/entity_browser/preview/entity_browser_preview_orbit.js';

/**
 * Returns points spread over the surface of a sphere: the ends of its three
 * axes and of its eight diagonals.
 *
 * @param sphere Sphere.
 * @returns Surface points.
 */
function sphereSurfacePoints(sphere: THREE.Sphere): THREE.Vector3[] {
  const directions: THREE.Vector3[] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (x !== 0 || y !== 0 || z !== 0) directions.push(new THREE.Vector3(x, y, z).normalize());
      }
    }
  }
  return directions.map((direction) => direction.multiplyScalar(sphere.radius).add(sphere.center));
}

/**
 * Returns whether every point projects inside the camera's view and depth
 * range.
 *
 * @param camera Camera.
 * @param points World points.
 * @returns True when all points are in view.
 */
function pointsInView(camera: THREE.PerspectiveCamera, points: readonly THREE.Vector3[]): boolean {
  return points.every((point) => {
    const projected = point.clone().project(camera);
    return Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1;
  });
}

/**
 * The orbit view of the entity browser's 3D tiles frames the subject from any
 * angle, turns with drags, zooms with the wheel within limits and resets.
 */
describe('EntityBrowserPreviewOrbit', () => {
  it('fits the whole subject sphere in view for wide, square and tall views after any drag', () => {
    const sphere = new THREE.Sphere(new THREE.Vector3(3, -2, 7), 2.5);
    const orbit = new EntityBrowserPreviewOrbit();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    for (const aspect of [0.5, 1, 2.5]) {
      for (const drag of [0, 140, -260]) {
        orbit.reset();
        orbit.dragBy(drag, drag / 2);
        camera.aspect = aspect;
        orbit.cameraPlace(camera, sphere);
        expect(pointsInView(camera, sphereSurfacePoints(sphere))).toBe(true);
        expect(
          camera.getWorldDirection(new THREE.Vector3()).dot(sphere.center.clone().sub(camera.position)),
        ).toBeGreaterThan(0);
      }
    }
  });

  it('turns around the subject when dragged sideways and keeps the look-down angle within its limit', () => {
    const orbit = new EntityBrowserPreviewOrbit();
    const yawBefore = orbit.yaw;
    orbit.dragBy(50, 0);
    expect(orbit.yaw).not.toBe(yawBefore);
    orbit.dragBy(0, 1e6);
    expect(orbit.pitch).toBe(ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT);
    orbit.dragBy(0, -1e7);
    expect(orbit.pitch).toBe(-ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT);
  });

  it('moves closer for negative wheel steps, farther for positive ones, within the zoom limits', () => {
    const orbit = new EntityBrowserPreviewOrbit();
    const sphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    orbit.cameraPlace(camera, sphere);
    const fittingDistance = camera.position.distanceTo(sphere.center);
    orbit.zoomBy(-100);
    orbit.cameraPlace(camera, sphere);
    expect(camera.position.distanceTo(sphere.center)).toBeLessThan(fittingDistance);
    orbit.zoomBy(1e6);
    expect(orbit.zoom).toBe(ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MAX);
    orbit.zoomBy(-1e7);
    expect(orbit.zoom).toBe(ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MIN);
  });

  it('returns to the fresh view on reset', () => {
    const fresh = new EntityBrowserPreviewOrbit();
    const orbit = new EntityBrowserPreviewOrbit();
    orbit.dragBy(80, 30);
    orbit.zoomBy(400);
    orbit.reset();
    expect([orbit.yaw, orbit.pitch, orbit.zoom]).toEqual([fresh.yaw, fresh.pitch, fresh.zoom]);
  });
});
