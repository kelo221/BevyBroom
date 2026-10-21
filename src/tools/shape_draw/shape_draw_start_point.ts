import * as THREE from 'three';
import { objectDragAnchorPointResolve } from '@/tools/object_drag/object_drag_anchor_point.js';
import type { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import type { ObjectDragViewport } from '@/tools/object_drag/object_drag_viewport.js';

/** Grid-local start of a shape drag and the side flat boxes grow toward. */
export interface ShapeDrawStartPoint {
  /** Grid-local start position. */
  startLocal: THREE.Vector3;
  /**
   * Grid-local direction pointing away from the picked surface toward the
   * viewer.
   */
  growDirectionLocal: THREE.Vector3;
}

/**
 * Resolves where a shape drag starts. The perspective view starts on the
 * surface under the pointer, else on the working grid plane, else at the
 * default spawn distance; 2D views start on the view plane under the pointer.
 *
 * @param viewport Viewport wrapper under the pointer.
 * @param gridFrame Working grid frame.
 * @param clientX Press client X.
 * @param clientY Press client Y.
 * @returns Start point in grid-local coordinates.
 */
export function shapeDrawStartPointResolve(
  viewport: ObjectDragViewport,
  gridFrame: ObjectDragGridFrame,
  clientX: number,
  clientY: number,
): ShapeDrawStartPoint {
  if (!viewport.isPerspective()) {
    return shapeDrawStartPointOnViewPlane(viewport, gridFrame, clientX, clientY);
  }
  const anchor = objectDragAnchorPointResolve(viewport, gridFrame, clientX, clientY);
  return {
    startLocal: gridFrame.positionToLocal(anchor.point),
    growDirectionLocal: gridFrame.vectorToLocal(anchor.awayDirection),
  };
}

/**
 * Resolves a 2D view start from the pick ray origin, whose in-plane coordinates
 * are exactly the point under the pointer.
 *
 * @param viewport Viewport wrapper under the pointer.
 * @param gridFrame Working grid frame.
 * @param clientX Press client X.
 * @param clientY Press client Y.
 * @returns Start point in grid-local coordinates.
 */
function shapeDrawStartPointOnViewPlane(
  viewport: ObjectDragViewport,
  gridFrame: ObjectDragGridFrame,
  clientX: number,
  clientY: number,
): ShapeDrawStartPoint {
  const ray = viewport.rayAtClientPoint(clientX, clientY);
  return {
    startLocal: gridFrame.positionToLocal(ray.origin),
    growDirectionLocal: gridFrame.vectorToLocal(ray.direction.clone().negate()),
  };
}
