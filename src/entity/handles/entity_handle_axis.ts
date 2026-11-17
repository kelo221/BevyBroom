import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { worldSizeFromScreenPixels } from '@/transform/bounds/bounds_handle_screen_size.js';

/** Length of a handle's move arrow on screen, in CSS pixels. */
export const ENTITY_HANDLE_ARROW_PIXELS = 44;

/**
 * Shortest share of its full length an arrow must keep on screen to be shown
 * and grabbed; arrows pointing into the screen are hidden.
 */
export const ENTITY_HANDLE_ARROW_MIN_SCREEN_SHARE = 0.3;

/**
 * Returns the plane that holds an axis line and faces the camera as much as
 * possible, so pointer rays meet it well while dragging along the axis.
 *
 * @param origin World point on the axis line.
 * @param axis Unit world direction of the axis.
 * @param viewDirection Unit world direction the camera looks along at the
 *   origin.
 * @returns Drag plane holding the axis line.
 */
export function entityHandleAxisDragPlane(
  origin: THREE.Vector3,
  axis: THREE.Vector3,
  viewDirection: THREE.Vector3,
): THREE.Plane {
  const sideways = new THREE.Vector3().crossVectors(viewDirection, axis);
  const normal = new THREE.Vector3().crossVectors(axis, sideways);
  if (normal.lengthSq() < 1e-10) {
    normal.copy(viewDirection);
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), origin);
}

/**
 * Returns the point of an axis line closest to a world point.
 *
 * @param origin World point on the axis line.
 * @param axis Unit world direction of the axis.
 * @param point World point to project.
 * @returns Projected point on the line.
 */
export function entityHandleAxisPointOf(
  origin: THREE.Vector3,
  axis: THREE.Vector3,
  point: THREE.Vector3,
): THREE.Vector3 {
  const along = point.clone().sub(origin).dot(axis);
  return origin.clone().addScaledVector(axis, along);
}

/**
 * Returns the gizmo colour of the world axis a direction runs closest to: red
 * for X, green for Y, blue for Z.
 *
 * @param axis World direction.
 * @returns Theme colour.
 */
export function entityHandleAxisColorOf(axis: THREE.Vector3): number {
  const x = Math.abs(axis.x);
  const y = Math.abs(axis.y);
  const z = Math.abs(axis.z);
  if (x >= y && x >= z) {
    return Theme.gizmoXAxisColor;
  }
  return y >= z ? Theme.gizmoYAxisColor : Theme.gizmoZAxisColor;
}

/**
 * Returns the unit world X, Y and Z directions.
 *
 * @returns Fresh world axes.
 */
export function entityHandleWorldAxes(): THREE.Vector3[] {
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
}

/**
 * Returns the world point where a handle's arrow ends, so the arrow keeps the
 * same length on screen at any zoom.
 *
 * @param camera Camera of the pane.
 * @param origin World position of the handle.
 * @param axis Unit world direction of the arrow.
 * @param viewportHeightPx Height of the pane in CSS pixels.
 * @returns World point of the arrow tip.
 */
export function entityHandleArrowTipWorld(
  camera: THREE.Camera,
  origin: THREE.Vector3,
  axis: THREE.Vector3,
  viewportHeightPx: number,
): THREE.Vector3 {
  const distance = origin.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  const length = worldSizeFromScreenPixels(camera, ENTITY_HANDLE_ARROW_PIXELS, viewportHeightPx, distance);
  return origin.clone().addScaledVector(axis, length);
}
