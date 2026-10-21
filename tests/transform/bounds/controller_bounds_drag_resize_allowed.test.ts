import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ControllerBoundsDrag } from '@/transform/bounds/controller_bounds_drag.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformMode } from '@/types/transform_mode.js';

/** Pixel size of the fake viewport. */
const VIEWPORT_PIXELS = 400;

/**
 * Builds a bounds drag controller around one box mesh in bounds mode.
 *
 * @returns Controller, its session, gizmo and the measured box.
 */
function boundsDragCreate(): {
  controller: ControllerBoundsDrag;
  session: TransformDragSession;
  gizmo: GizmoTransform;
  box: THREE.Mesh;
} {
  const session = new TransformDragSession();
  const gizmo = new GizmoTransform(Theme);
  gizmo.setMode(TransformMode.BOUNDS);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  box.updateMatrixWorld(true);
  gizmo.updateBoundsFromMeshes([box]);
  const controller = new ControllerBoundsDrag(
    session,
    gizmo,
    new GizmoRaycaster(),
    new TransformExecutor(new GridSnap(false, 1)),
  );
  return { controller, session, gizmo, box };
}

/**
 * Creates an orthographic camera looking straight down at the origin.
 *
 * @returns Top view camera.
 */
function topCameraCreate(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Creates a pick element of the fake viewport's size at the page origin.
 *
 * @returns Element with a fixed client rectangle.
 */
function pickElementCreate(): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientHeight', { value: VIEWPORT_PIXELS });
  Object.defineProperty(element, 'clientWidth', { value: VIEWPORT_PIXELS });
  element.getBoundingClientRect = () => new DOMRect(0, 0, VIEWPORT_PIXELS, VIEWPORT_PIXELS);
  return element;
}

/**
 * Creates a pointer press over a world point as seen by a camera.
 *
 * @param camera Viewing camera.
 * @param worldPoint Point under the pointer.
 * @returns Mouse event at the projected pixel.
 */
function pressOver(camera: THREE.Camera, worldPoint: THREE.Vector3): MouseEvent {
  const ndc = worldPoint.clone().project(camera);
  const clientX = ((ndc.x + 1) / 2) * VIEWPORT_PIXELS;
  const clientY = ((1 - ndc.y) / 2) * VIEWPORT_PIXELS;
  return new MouseEvent('pointerdown', { clientX, clientY, button: 0 });
}

describe('ControllerBoundsDrag resize permission', () => {
  it('starts a resize from a silhouette edge only while resizing is allowed', () => {
    const results = [true, false].map((allowed) => {
      const { controller, session, gizmo, box } = boundsDragCreate();
      gizmo.setBoundsResizeAllowed(allowed);
      const camera = topCameraCreate();
      const edgePoint = new THREE.Vector3(1, 0, 0);
      const press = pressOver(camera, edgePoint);
      controller.beginPointerDown(
        camera,
        pickElementCreate(),
        press,
        [],
        [box],
        new THREE.Vector3(),
        new THREE.Group(),
        'xz',
      );
      return session.isBoundsResize;
    });
    expect(results).toEqual([true, false]);
  });
});
