import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { type DataOrientedBounds } from './builder_oriented_bounds.js';
import { getHiddenBoundsAxesForViewPlane, type CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import { boundsHandleFacesLocalPullDirection, boundsHandleFacesTouchAxes } from './handle/bounds_handle_faces.js';

/** Default viewport cursor when not over a bounds control. */
export const BOUNDS_DEFAULT_CURSOR = 'default';

/**
 * Resolves a CSS resize cursor for a bounds handle so the pointer arrows match
 * the pull direction. Uses standard browser cursors (`ew-resize`, `ns-resize`,
 * `nwse-resize`, `nesw-resize`).
 *
 * The pull direction (the face normal, or the sum of both normals for a corner)
 * is projected into screen space, so corners and rotated OBBs get diagonal
 * cursors. Handles on depth-axis faces in ortho panes stay default (not
 * resizable there).
 *
 * @param faces Faces dragged by the hovered handle (two for a corner).
 * @param bounds Current oriented bounds (for world normals).
 * @param camera Active viewport camera.
 * @param viewPlane Optional view plane for depth-axis filtering in 2D.
 * @returns CSS cursor keyword.
 */
export function resolveBoundsResizeCursor(
  faces: readonly BoundsFace[],
  bounds: DataOrientedBounds,
  camera: THREE.Camera,
  viewPlane: CadViewPlane = 'xyz',
): string {
  if (faces.length === 0) {
    return BOUNDS_DEFAULT_CURSOR;
  }
  if (viewPlane !== 'xyz' && boundsHandleFacesTouchAxes(faces, getHiddenBoundsAxesForViewPlane(viewPlane))) {
    return BOUNDS_DEFAULT_CURSOR;
  }
  return resolveScreenProjectedResizeCursor(faces, bounds, camera);
}

/**
 * Chooses a resize cursor from the handle pull direction projected into screen
 * space.
 *
 * @param faces Faces dragged by the handle.
 * @param bounds Oriented bounds for the world normals.
 * @param camera Active viewport camera.
 * @returns CSS cursor keyword.
 */
function resolveScreenProjectedResizeCursor(
  faces: readonly BoundsFace[],
  bounds: DataOrientedBounds,
  camera: THREE.Camera,
): string {
  camera.updateMatrixWorld(true);
  const worldPull = boundsHandleFacesLocalPullDirection(faces).applyQuaternion(bounds.quaternion).normalize();
  const origin = bounds.center.clone();
  const tip = origin.clone().add(worldPull);
  const screenOrigin = origin.project(camera);
  const screenTip = tip.project(camera);
  const deltaX = screenTip.x - screenOrigin.x;
  const deltaYCss = -(screenTip.y - screenOrigin.y);
  return cursorFromScreenDelta(deltaX, deltaYCss);
}

/**
 * Picks among the four dual-arrow CSS resize cursors from a screen delta.
 *
 * @param deltaX Screen-space X component of the pull direction.
 * @param deltaY Screen-space Y component with CSS orientation (down positive).
 * @returns CSS cursor keyword.
 */
export function cursorFromScreenDelta(deltaX: number, deltaY: number): string {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < 1e-8 && absY < 1e-8) return BOUNDS_DEFAULT_CURSOR;
  if (absX > absY * 2) return 'ew-resize';
  if (absY > absX * 2) return 'ns-resize';
  const sameSignInCssSpace = deltaX * deltaY >= 0;
  if (sameSignInCssSpace) return 'nwse-resize';
  return 'nesw-resize';
}
