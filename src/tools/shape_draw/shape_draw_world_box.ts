import * as THREE from 'three';
import type { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';

/** A box placed in the world: center, edge lengths and orientation. */
export interface ShapeDrawWorldBox {
  /** World center. */
  center: THREE.Vector3;
  /** Edge lengths along the box's own X, Y and Z axes. */
  size: THREE.Vector3;
  /** World orientation of the box axes. */
  orientation: THREE.Quaternion;
}

/**
 * Places a grid-local box in the world using the working grid frame.
 *
 * @param localBox Box in grid-local coordinates.
 * @param gridFrame Working grid frame.
 * @returns World box aligned with the grid.
 */
export function shapeDrawWorldBoxFromLocal(localBox: THREE.Box3, gridFrame: ObjectDragGridFrame): ShapeDrawWorldBox {
  return {
    center: gridFrame.positionToWorld(localBox.getCenter(new THREE.Vector3())),
    size: localBox.getSize(new THREE.Vector3()),
    orientation: gridFrame.orientationWorld(),
  };
}
