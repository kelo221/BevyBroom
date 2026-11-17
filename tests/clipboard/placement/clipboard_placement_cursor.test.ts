import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CLIPBOARD_PLACEMENT_AIM_OPTIONS_PASTE,
  clipboardPlacementAimFromViewportPoint,
  clipboardPlacementAimOffsetCompute,
  clipboardPlacementCursorOffsetCompute,
} from '@/clipboard/placement/clipboard_placement_cursor.js';

/**
 * Builds a perspective camera at a position looking at a target.
 *
 * @param position Camera position.
 * @param target Point in the middle of the view.
 * @returns Camera.
 */
function perspectiveCameraCreate(position: THREE.Vector3, target: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * Returns a view point at the middle of a view element. Test elements have no
 * size, so the middle is half a pixel in.
 *
 * @param camera View camera.
 * @returns View point.
 */
function viewMiddlePointCreate(camera: THREE.Camera): {
  camera: THREE.Camera;
  pickElement: HTMLElement;
  clientX: number;
  clientY: number;
} {
  return { camera, pickElement: document.createElement('div'), clientX: 0.5, clientY: 0.5 };
}

/** Placement of pastes under the pointer of a real view camera. */
describe('clipboard placement cursor', () => {
  const contentBounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

  it('rests pasted content on top of a mesh under the pointer of a 3D view', () => {
    const world = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 20), new THREE.MeshBasicMaterial());
    floor.position.set(3, 5, -4);
    world.add(floor);
    world.updateMatrixWorld(true);
    const camera = perspectiveCameraCreate(new THREE.Vector3(3, 30, -4), floor.position);
    const offset = clipboardPlacementCursorOffsetCompute(viewMiddlePointCreate(camera), contentBounds, world, 0);
    const moved = contentBounds.clone().translate(offset);
    const floorTop = new THREE.Box3().setFromObject(floor).max.y;
    expect(moved.min.y).toBeCloseTo(floorTop, 5);
    expect(moved.getCenter(new THREE.Vector3()).x).toBeCloseTo(floor.position.x, 5);
  });

  it('rests pasted content on the ground grid plane when no mesh is under the pointer', () => {
    const target = new THREE.Vector3(6, 0, 2);
    const camera = perspectiveCameraCreate(new THREE.Vector3(6, 25, 12), target);
    const offset = clipboardPlacementCursorOffsetCompute(
      viewMiddlePointCreate(camera),
      contentBounds,
      new THREE.Group(),
      0,
    );
    const moved = contentBounds.clone().translate(offset);
    expect(moved.min.y).toBeCloseTo(0, 5);
    expect(moved.getCenter(new THREE.Vector3()).setY(0).distanceTo(target)).toBeLessThan(1e-4);
  });

  it('keeps the depth of pasted content in an orthographic view', () => {
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    camera.position.set(4, 2, 50);
    camera.lookAt(4, 2, 0);
    camera.updateMatrixWorld();
    const offset = clipboardPlacementCursorOffsetCompute(
      viewMiddlePointCreate(camera),
      contentBounds,
      new THREE.Group(),
      1,
    );
    expect(offset.z).toBe(0);
    expect(offset.x).toBe(4);
    expect(offset.y).toBe(2);
  });
});

/**
 * Builds an orthographic camera looking straight down at a point from far
 * above.
 *
 * @param target Point in the middle of the view.
 * @param height Height of the camera above the target.
 * @returns Camera.
 */
function orthographicTopCameraCreate(target: THREE.Vector3, height: number): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, height * 4);
  camera.position.copy(target).setY(target.y + height);
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

/** Placement of content at an aimed point of a view. */
describe('clipboard placement aim', () => {
  const contentBounds = new THREE.Box3(new THREE.Vector3(-1, 7, -1), new THREE.Vector3(1, 9, 1));
  const restingOptions = { isRestingInDownwardViews: true };

  it('aims at the same point a pointer at the middle of the view does', () => {
    const camera = perspectiveCameraCreate(new THREE.Vector3(2, 20, 9), new THREE.Vector3(2, 0, 1));
    const aim = clipboardPlacementAimFromViewportPoint(viewMiddlePointCreate(camera));
    const aimed = clipboardPlacementAimOffsetCompute(
      aim,
      contentBounds,
      new THREE.Group(),
      0,
      CLIPBOARD_PLACEMENT_AIM_OPTIONS_PASTE,
    );
    const pointed = clipboardPlacementCursorOffsetCompute(
      viewMiddlePointCreate(camera),
      contentBounds,
      new THREE.Group(),
      0,
    );
    expect(aimed.distanceTo(pointed)).toBeLessThan(1e-6);
  });

  it('rests content on the surface under a top view aim when asked to', () => {
    const world = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), new THREE.MeshBasicMaterial());
    platform.position.set(-5, 1.5, 6);
    world.add(platform);
    world.updateMatrixWorld(true);
    const camera = orthographicTopCameraCreate(platform.position, 500);
    const aim = { camera, ndc: new THREE.Vector2(0, 0) };
    const moved = contentBounds
      .clone()
      .translate(clipboardPlacementAimOffsetCompute(aim, contentBounds, world, 1, restingOptions));
    expect(moved.min.y).toBeCloseTo(new THREE.Box3().setFromObject(platform).max.y, 5);
    expect(moved.getCenter(new THREE.Vector3()).x).toBeCloseTo(platform.position.x, 5);
    expect(moved.getCenter(new THREE.Vector3()).z).toBeCloseTo(platform.position.z, 5);
  });

  it('rests content on the ground plane in a top view far above it', () => {
    const target = new THREE.Vector3(12, 0, -3);
    const aim = { camera: orthographicTopCameraCreate(target, 900), ndc: new THREE.Vector2(0, 0) };
    const offset = clipboardPlacementAimOffsetCompute(aim, contentBounds, new THREE.Group(), 1, restingOptions);
    const moved = contentBounds.clone().translate(offset);
    expect(moved.min.y).toBeCloseTo(0, 5);
    expect(moved.getCenter(new THREE.Vector3()).setY(0).distanceTo(target)).toBeLessThan(1e-4);
  });

  it('keeps the depth in a top view for a paste', () => {
    const aim = { camera: orthographicTopCameraCreate(new THREE.Vector3(4, 0, 4), 300), ndc: new THREE.Vector2(0, 0) };
    const offset = clipboardPlacementAimOffsetCompute(
      aim,
      contentBounds,
      new THREE.Group(),
      1,
      CLIPBOARD_PLACEMENT_AIM_OPTIONS_PASTE,
    );
    expect(offset.y).toBe(0);
  });
});
