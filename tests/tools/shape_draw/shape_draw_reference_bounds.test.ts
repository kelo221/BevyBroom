import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import {
  SHAPE_DRAW_DEFAULT_REFERENCE_EDGE,
  ShapeDrawReferenceBoundsTracker,
} from '@/tools/shape_draw/shape_draw_reference_bounds.js';

/**
 * Creates a box mesh with a given size at a position.
 *
 * @param size Box edge lengths.
 * @param position World position.
 * @returns New mesh.
 */
function boxMeshCreate(size: THREE.Vector3, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
  mesh.position.copy(position);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Proves 2D drawn brushes take their depth from the current selection, then
 * from the last non-empty selection, then from a default cube at the origin.
 */
describe('ShapeDrawReferenceBoundsTracker', () => {
  it('uses a cube centered at the origin when nothing was ever selected', () => {
    const tracker = new ShapeDrawReferenceBoundsTracker(new ManagerSelection());
    const bounds = tracker.referenceBoundsResolve();
    expect(bounds.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0, 9);
    expect(bounds.getSize(new THREE.Vector3()).toArray()).toEqual([
      SHAPE_DRAW_DEFAULT_REFERENCE_EDGE,
      SHAPE_DRAW_DEFAULT_REFERENCE_EDGE,
      SHAPE_DRAW_DEFAULT_REFERENCE_EDGE,
    ]);
    tracker.dispose();
  });

  it('uses the bounds of the current selection', () => {
    const selection = new ManagerSelection();
    const tracker = new ShapeDrawReferenceBoundsTracker(selection);
    const mesh = boxMeshCreate(new THREE.Vector3(1, 3, 5), new THREE.Vector3(7, -2, 4));
    selection.selectObject(mesh);
    const expected = new THREE.Box3().setFromObject(mesh);
    expect(tracker.referenceBoundsResolve().equals(expected)).toBe(true);
    tracker.dispose();
  });

  it('remembers the last non-empty selection after the selection is cleared', () => {
    const selection = new ManagerSelection();
    const tracker = new ShapeDrawReferenceBoundsTracker(selection);
    const first = boxMeshCreate(new THREE.Vector3(1, 1, 1), new THREE.Vector3(-6, 0, 0));
    const second = boxMeshCreate(new THREE.Vector3(2, 4, 2), new THREE.Vector3(3, 5, -8));
    selection.selectObject(first);
    selection.selectObject(second);
    selection.clearSelection();
    const expected = new THREE.Box3().setFromObject(second);
    expect(tracker.referenceBoundsResolve().equals(expected)).toBe(true);
    tracker.dispose();
  });

  it('remembers a selection that existed before the tracker was created', () => {
    const selection = new ManagerSelection();
    const mesh = boxMeshCreate(new THREE.Vector3(2, 2, 2), new THREE.Vector3(1, 9, 1));
    selection.selectObject(mesh);
    const tracker = new ShapeDrawReferenceBoundsTracker(selection);
    selection.clearSelection();
    expect(tracker.referenceBoundsResolve().equals(new THREE.Box3().setFromObject(mesh))).toBe(true);
    tracker.dispose();
  });

  it('stops observing the selection once disposed', () => {
    const selection = new ManagerSelection();
    const tracker = new ShapeDrawReferenceBoundsTracker(selection);
    tracker.dispose();
    selection.selectObject(boxMeshCreate(new THREE.Vector3(1, 1, 1), new THREE.Vector3(20, 0, 0)));
    selection.clearSelection();
    const bounds = tracker.referenceBoundsResolve();
    expect(bounds.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0, 9);
  });
});
