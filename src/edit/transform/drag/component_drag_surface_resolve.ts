import * as THREE from 'three';
import { TransformProjectionMath } from '@/transform/core/transform_projection_math.js';
import type { ComponentDragSurface } from './component_drag_surface.js';

/**
 * Largest |cos| between a drag line and the view direction that still drags
 * well.
 */
const COMPONENT_DRAG_LINE_VIEW_ALIGNMENT_MAXIMUM = 0.97;

/**
 * Smallest |cos| between a drag plane normal and the view direction that still
 * drags well.
 */
const COMPONENT_DRAG_PLANE_VIEW_ALIGNMENT_MINIMUM = 0.2;

/** Everything that decides which surface a component drag moves on. */
export interface ComponentDragSurfaceRequest {
  /** Viewport camera. */
  readonly camera: THREE.Camera;
  /** World pivot of the dragged components. */
  readonly pivot: THREE.Vector3;
  /** Unit direction of an axis lock (key X/Y/Z or a gizmo arrow), or null. */
  readonly lockedLineDirection: THREE.Vector3 | null;
  /** Unit normal of a plane lock (a gizmo plane handle), or null. */
  readonly lockedPlaneNormal: THREE.Vector3 | null;
  /**
   * Unit world normal of the dragged faces when only faces are dragged, or
   * null.
   */
  readonly faceNormal: THREE.Vector3 | null;
  /** Unit up direction of the working grid. */
  readonly gridUp: THREE.Vector3;
}

/**
 * Picks the surface a component drag moves on. Axis and plane locks win; flat
 * 2D views drag in their view plane; dragged faces slide along their normal;
 * everything else slides on the working grid plane through the pivot. A line
 * seen end-on or a plane seen edge-on falls back to the plane facing the
 * camera.
 *
 * @param request Camera, pivot, locks and hints.
 * @returns Drag surface.
 */
export function componentDragSurfaceResolve(request: ComponentDragSurfaceRequest): ComponentDragSurface {
  const viewDirection = componentDragViewDirection(request.camera, request.pivot);
  const lockedSurface = componentDragLockedSurfaceResolve(request, viewDirection);
  if (lockedSurface) {
    return lockedSurface;
  }
  if (request.camera instanceof THREE.OrthographicCamera) {
    return componentDragCameraPlaneCreate(request);
  }
  if (request.faceNormal && componentDragLineUsable(request.faceNormal, viewDirection)) {
    return { kind: 'line', origin: request.pivot.clone(), direction: request.faceNormal.clone() };
  }
  return componentDragPlaneOrCameraPlane(request, request.gridUp, viewDirection);
}

/**
 * Returns the surface of an axis or plane lock.
 *
 * @param request Camera, pivot and locks.
 * @param viewDirection Unit direction from the camera toward the pivot.
 * @returns Locked surface, or null when nothing is locked.
 */
function componentDragLockedSurfaceResolve(
  request: ComponentDragSurfaceRequest,
  viewDirection: THREE.Vector3,
): ComponentDragSurface | null {
  const line = request.lockedLineDirection;
  if (line) {
    if (!componentDragLineUsable(line, viewDirection)) {
      return componentDragCameraPlaneCreate(request);
    }
    return { kind: 'line', origin: request.pivot.clone(), direction: line.clone().normalize() };
  }
  if (request.lockedPlaneNormal) {
    return componentDragPlaneOrCameraPlane(request, request.lockedPlaneNormal, viewDirection);
  }
  return null;
}

/**
 * Returns the plane through the pivot with a normal, or the camera plane when
 * that plane is seen edge-on.
 *
 * @param request Camera and pivot.
 * @param normal Unit plane normal.
 * @param viewDirection Unit direction from the camera toward the pivot.
 * @returns Drag plane.
 */
function componentDragPlaneOrCameraPlane(
  request: ComponentDragSurfaceRequest,
  normal: THREE.Vector3,
  viewDirection: THREE.Vector3,
): ComponentDragSurface {
  if (Math.abs(normal.dot(viewDirection)) < COMPONENT_DRAG_PLANE_VIEW_ALIGNMENT_MINIMUM) {
    return componentDragCameraPlaneCreate(request);
  }
  return {
    kind: 'plane',
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().normalize(), request.pivot),
  };
}

/**
 * Returns whether a drag line is far enough from the view direction to follow
 * the pointer.
 *
 * @param direction Unit line direction.
 * @param viewDirection Unit direction from the camera toward the pivot.
 * @returns True when the line is not seen end-on.
 */
function componentDragLineUsable(direction: THREE.Vector3, viewDirection: THREE.Vector3): boolean {
  return Math.abs(direction.dot(viewDirection)) < COMPONENT_DRAG_LINE_VIEW_ALIGNMENT_MAXIMUM;
}

/**
 * Builds the camera-facing plane through the pivot.
 *
 * @param request Camera and pivot.
 * @returns Camera plane surface.
 */
function componentDragCameraPlaneCreate(request: ComponentDragSurfaceRequest): ComponentDragSurface {
  return { kind: 'plane', plane: TransformProjectionMath.buildCameraPlane(request.camera, request.pivot) };
}

/**
 * Returns the direction the camera looks at the pivot from: the camera forward
 * for orthographic cameras, otherwise from the camera position to the pivot.
 *
 * @param camera Viewport camera.
 * @param pivot World pivot.
 * @returns Unit view direction.
 */
function componentDragViewDirection(camera: THREE.Camera, pivot: THREE.Vector3): THREE.Vector3 {
  if (camera instanceof THREE.OrthographicCamera) {
    return TransformProjectionMath.getCameraForwardDirection(camera);
  }
  const toPivot = pivot.clone().sub(camera.getWorldPosition(new THREE.Vector3()));
  if (toPivot.lengthSq() < 1e-12) {
    return TransformProjectionMath.getCameraForwardDirection(camera);
  }
  return toPivot.normalize();
}
