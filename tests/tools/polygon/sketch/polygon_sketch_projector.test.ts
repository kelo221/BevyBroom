import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { PolygonSketchFrame } from '@/tools/polygon/sketch/polygon_sketch_frame.js';
import { PolygonSketchProjector } from '@/tools/polygon/sketch/polygon_sketch_projector.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  OBJECT_DRAG_TEST_VIEWPORT_RECT,
  type ObjectDragTestViewport,
} from '../../object_drag/object_drag_test_viewport.js';

/** Largest world distance accepted between a projected and an aimed point. */
const SKETCH_PROJECTOR_TEST_TOLERANCE = 1e-3;

/**
 * Builds a projector over one test viewport.
 *
 * @param testViewport Viewport every client point resolves to when inside it.
 * @param gridSnap Grid snap the projector reads.
 * @returns Projector.
 */
function projectorOverViewportCreate(testViewport: ObjectDragTestViewport, gridSnap: GridSnap): PolygonSketchProjector {
  return new PolygonSketchProjector({
    viewportAtClientPoint: (clientX, clientY) => {
      const rect = OBJECT_DRAG_TEST_VIEWPORT_RECT;
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      return inside ? testViewport.source : null;
    },
    gridSnap,
  });
}

/**
 * Projects the client point over a world point and converts the hit back to
 * world space.
 *
 * @param projector Projector under test.
 * @param testViewport Viewport the world point is seen in.
 * @param worldPoint Aimed world point.
 * @returns World point of the hit, or null when nothing was hit.
 */
function projectedWorldPointRead(
  projector: PolygonSketchProjector,
  testViewport: ObjectDragTestViewport,
  worldPoint: THREE.Vector3,
): THREE.Vector3 | null {
  const client = objectDragTestClientPoint(testViewport, worldPoint);
  const hit = projector.project(client.clientX, client.clientY, null, 2);
  return hit ? PolygonSketchFrame.worldPointAt(hit.frame, hit.point, 0) : null;
}

describe('PolygonSketchProjector', () => {
  it('sketches on the plane facing the camera of each 2D view', () => {
    const gridSnap = new GridSnap(false, 1);
    const cases: ReadonlyArray<readonly [ViewportKind, THREE.Vector3]> = [
      [ViewportKind.TOP, new THREE.Vector3(3.5, 0, -2.25)],
      [ViewportKind.FRONT, new THREE.Vector3(-1.75, 4.5, 0)],
      [ViewportKind.SIDE, new THREE.Vector3(0, 2.5, 3.25)],
    ];
    for (const [kind, worldPoint] of cases) {
      const testViewport = objectDragTestViewportCreate(kind);
      const projector = projectorOverViewportCreate(testViewport, gridSnap);
      const client = objectDragTestClientPoint(testViewport, worldPoint);
      const hit = projector.project(client.clientX, client.clientY, null, 2);
      const forward = testViewport.camera.getWorldDirection(new THREE.Vector3());
      expect(hit?.frame.axisNormal.dot(forward)).toBeCloseTo(-1, 6);
      const back = projectedWorldPointRead(projector, testViewport, worldPoint);
      expect(back?.distanceTo(worldPoint)).toBeLessThan(SKETCH_PROJECTOR_TEST_TOLERANCE);
    }
  });

  it('sketches on the working grid plane in the 3D view', () => {
    const gridSnap = new GridSnap(false, 1);
    const plane = gridSnap.getPlaneFrame();
    plane.origin.addScaledVector(plane.normal, 1.5);
    gridSnap.setPlaneFrame(plane);
    const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE);
    const projector = projectorOverViewportCreate(testViewport, gridSnap);
    const aimed = plane.origin.clone().addScaledVector(plane.uAxis, 2).addScaledVector(plane.vAxis, -3);
    const back = projectedWorldPointRead(projector, testViewport, aimed);
    expect(back?.distanceTo(aimed)).toBeLessThan(SKETCH_PROJECTOR_TEST_TOLERANCE);
  });

  it('snaps points to the grid interval while snapping is on', () => {
    const interval = 0.5;
    const testViewport = objectDragTestViewportCreate(ViewportKind.TOP);
    const projector = projectorOverViewportCreate(testViewport, new GridSnap(true, interval));
    const client = objectDragTestClientPoint(testViewport, new THREE.Vector3(1.37, 0, 2.61));
    const hit = projector.project(client.clientX, client.clientY, null, 2);
    expect(hit).not.toBeNull();
    const point = hit?.point ?? new THREE.Vector2(Number.NaN, Number.NaN);
    expect(Math.abs(point.x / interval - Math.round(point.x / interval))).toBeLessThan(1e-6);
    expect(Math.abs(point.y / interval - Math.round(point.y / interval))).toBeLessThan(1e-6);
  });

  it('keeps a locked frame and misses when the view looks along that plane', () => {
    const gridSnap = new GridSnap(false, 1);
    const topViewport = objectDragTestViewportCreate(ViewportKind.TOP);
    const topClient = objectDragTestClientPoint(topViewport, new THREE.Vector3(1, 0, 1));
    const topHit = projectorOverViewportCreate(topViewport, gridSnap).project(
      topClient.clientX,
      topClient.clientY,
      null,
      2,
    );
    expect(topHit).not.toBeNull();
    const frontViewport = objectDragTestViewportCreate(ViewportKind.FRONT);
    const frontProjector = projectorOverViewportCreate(frontViewport, gridSnap);
    const frontClient = objectDragTestClientPoint(frontViewport, new THREE.Vector3(1, 0, 0));
    const lockedFrame = topHit?.frame ?? null;
    expect(lockedFrame).not.toBeNull();
    expect(frontProjector.project(frontClient.clientX, frontClient.clientY, lockedFrame, 2)).toBeNull();
  });

  it('returns null outside every view', () => {
    const testViewport = objectDragTestViewportCreate(ViewportKind.TOP);
    const projector = projectorOverViewportCreate(testViewport, new GridSnap(false, 1));
    const rect = OBJECT_DRAG_TEST_VIEWPORT_RECT;
    expect(projector.project(rect.right + 50, rect.bottom + 50, null, 2)).toBeNull();
  });
});
