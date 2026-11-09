import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PolygonSketchFrame } from '@/tools/polygon/sketch/polygon_sketch_frame.js';

/** Tolerance for floating point comparisons in these tests. */
const SKETCH_FRAME_TEST_EPSILON = 1e-6;

/**
 * Returns a camera looking at a target from a position, with its world matrix
 * updated.
 *
 * @param position Camera position.
 * @param target Point the camera looks at.
 * @param up Camera up vector.
 * @returns Camera.
 */
function cameraLookingCreate(position: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3): THREE.Camera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.up.copy(up);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

describe('PolygonSketchFrame', () => {
  it('builds a right-handed orthonormal frame facing the camera of a view', () => {
    const camera = cameraLookingCreate(new THREE.Vector3(3, 7, 11), new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    const origin = new THREE.Vector3(1, 2, 3);
    const frame = PolygonSketchFrame.fromView(forward, up, origin, 4);
    expect(frame.axisNormal.dot(forward)).toBeCloseTo(-1, 6);
    expect(frame.axisU.dot(frame.axisV)).toBeCloseTo(0, 6);
    expect(frame.axisU.length()).toBeCloseTo(1, 6);
    expect(frame.axisV.length()).toBeCloseTo(1, 6);
    const handedness = new THREE.Vector3().crossVectors(frame.axisU, frame.axisV);
    expect(handedness.distanceTo(frame.axisNormal)).toBeLessThan(SKETCH_FRAME_TEST_EPSILON);
    expect(frame.origin.equals(origin)).toBe(true);
    expect(frame.extrusionMax - frame.extrusionMin).toBe(4);
  });

  it('maps a ray hit to sketch coordinates that convert back to the hit point', () => {
    const frame = PolygonSketchFrame.fromGridPlane(
      {
        origin: new THREE.Vector3(2, -1, 5),
        normal: new THREE.Vector3(0, 1, 0),
        uAxis: new THREE.Vector3(1, 0, 0),
        vAxis: new THREE.Vector3(0, 0, 1),
      },
      2,
    );
    const target = PolygonSketchFrame.worldPointAt(frame, new THREE.Vector2(3.25, -1.5), 0);
    const ray = new THREE.Ray(
      target.clone().add(new THREE.Vector3(1, 6, 2)),
      new THREE.Vector3(-1, -6, -2).normalize(),
    );
    const point = PolygonSketchFrame.pointOnPlane(ray, frame, 0, false);
    expect(point).not.toBeNull();
    const back = PolygonSketchFrame.worldPointAt(frame, point ?? new THREE.Vector2(), 0);
    expect(back.distanceTo(target)).toBeLessThan(SKETCH_FRAME_TEST_EPSILON);
  });

  it('snaps sketch coordinates to the snap step', () => {
    const frame = PolygonSketchFrame.fromView(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      1,
    );
    const target = PolygonSketchFrame.worldPointAt(frame, new THREE.Vector2(2.3, -0.8), 0);
    const ray = new THREE.Ray(target.clone().addScaledVector(frame.axisNormal, 10), frame.axisNormal.clone().negate());
    const point = PolygonSketchFrame.pointOnPlane(ray, frame, 0.5, false);
    expect(point?.x).toBeCloseTo(2.5, 6);
    expect(point?.y).toBeCloseTo(-1, 6);
  });

  it('rejects rays that graze the plane and perspective rays pointing away from it', () => {
    const frame = PolygonSketchFrame.fromView(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(),
      1,
    );
    const grazing = new THREE.Ray(new THREE.Vector3(0, 5, 0), frame.axisU.clone());
    expect(PolygonSketchFrame.pointOnPlane(grazing, frame, 0, true)).toBeNull();
    const awayRay = new THREE.Ray(new THREE.Vector3(0, 5, 0), frame.axisNormal.clone());
    expect(PolygonSketchFrame.pointOnPlane(awayRay, frame, 0, false)).toBeNull();
    expect(PolygonSketchFrame.pointOnPlane(awayRay, frame, 0, true)).not.toBeNull();
  });

  it('copies frames deeply', () => {
    const frame = PolygonSketchFrame.fromView(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      1,
    );
    const copy = PolygonSketchFrame.copy(frame);
    copy.origin.x += 1;
    copy.axisU.negate();
    expect(frame.origin.x).toBe(0);
    expect(frame.axisU.equals(copy.axisU)).toBe(false);
  });
});
