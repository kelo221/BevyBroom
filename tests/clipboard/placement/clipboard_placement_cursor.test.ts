import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipboardPlacementCursorOffsetCompute } from '@/clipboard/placement/clipboard_placement_cursor.js';

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
