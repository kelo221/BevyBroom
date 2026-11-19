import * as THREE from 'three';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { ComponentDragSurface } from './component_drag_surface.js';

/** Smallest |component| of a unit vector that counts as lying on a world axis. */
const COMPONENT_DRAG_AXIS_ALIGNED_MINIMUM = 0.9999;

/** Smallest movement along a world axis that snaps that axis. */
const COMPONENT_DRAG_AXIS_MOVED_MINIMUM = 1e-6;

/** World axis names. */
const COMPONENT_DRAG_AXES = ['x', 'y', 'z'] as const;

/**
 * Snaps a drag delta so the anchor vertex lands on the grid, not just moves by
 * whole grid steps. Along a world-axis line or on a world-axis plane each moved
 * axis of the anchor snaps to the nearest grid line; along a slanted line the
 * travel distance snaps to the grid step; on a slanted plane the delta snaps in
 * grid steps. Nothing changes while snapping is off.
 *
 * @param delta Constrained world delta. Not modified.
 * @param anchor World position of the vertex that should land on the grid.
 * @param surface Surface the drag moves on.
 * @param gridSnap Grid snap settings.
 * @returns Snapped world delta.
 */
export function componentDragDeltaSnap(
  delta: THREE.Vector3,
  anchor: THREE.Vector3,
  surface: ComponentDragSurface,
  gridSnap: GridSnap,
): THREE.Vector3 {
  if (!gridSnap.isEnabled()) {
    return delta.clone();
  }
  const surfaceDirection = surface.kind === 'line' ? surface.direction : surface.plane.normal;
  if (componentDragAxisAligned(surfaceDirection)) {
    return componentDragDeltaSnapAnchorAxes(delta, anchor, gridSnap);
  }
  if (surface.kind === 'line') {
    const distance = gridSnap.snapValue(delta.dot(surface.direction));
    return surface.direction.clone().multiplyScalar(distance);
  }
  const stepped = delta.clone();
  gridSnap.snapVector3(stepped);
  return stepped;
}

/**
 * Snaps every moved world axis of the anchor to the nearest grid line.
 *
 * @param delta World delta. Not modified.
 * @param anchor World anchor position.
 * @param gridSnap Grid snap settings.
 * @returns Delta that brings the anchor onto the grid on its moved axes.
 */
function componentDragDeltaSnapAnchorAxes(
  delta: THREE.Vector3,
  anchor: THREE.Vector3,
  gridSnap: GridSnap,
): THREE.Vector3 {
  const snapped = delta.clone();
  for (const axis of COMPONENT_DRAG_AXES) {
    if (Math.abs(delta[axis]) > COMPONENT_DRAG_AXIS_MOVED_MINIMUM) {
      snapped[axis] = gridSnap.snapValue(anchor[axis] + delta[axis]) - anchor[axis];
    }
  }
  return snapped;
}

/**
 * Returns whether a unit direction lies on a world axis.
 *
 * @param direction Unit direction.
 * @returns True for ±X, ±Y and ±Z.
 */
function componentDragAxisAligned(direction: THREE.Vector3): boolean {
  return COMPONENT_DRAG_AXES.some((axis) => Math.abs(direction[axis]) >= COMPONENT_DRAG_AXIS_ALIGNED_MINIMUM);
}
