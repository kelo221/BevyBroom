import * as THREE from 'three';

/** Half length of the segment that stands in for an endless drag line. */
const COMPONENT_DRAG_LINE_HALF_LENGTH = 100000;

/** A line the dragged components slide along. */
export interface ComponentDragSurfaceLine {
  readonly kind: 'line';
  /** World point on the line. */
  readonly origin: THREE.Vector3;
  /** Unit world direction of the line. */
  readonly direction: THREE.Vector3;
}

/** A plane the dragged components slide on. */
export interface ComponentDragSurfacePlane {
  readonly kind: 'plane';
  /** World plane. */
  readonly plane: THREE.Plane;
}

/** Where a component drag moves the pointer hit: along a line or on a plane. */
export type ComponentDragSurface = ComponentDragSurfaceLine | ComponentDragSurfacePlane;

/**
 * Builds the world pick ray under a client pointer position.
 *
 * @param camera Viewport camera.
 * @param pickElement Element the viewport draws into.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns World ray from the camera through the pointer.
 */
export function componentDragPointerRayBuild(
  camera: THREE.Camera,
  pickElement: HTMLElement,
  clientX: number,
  clientY: number,
): THREE.Ray {
  const rect = pickElement.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  return raycaster.ray.clone();
}

/**
 * Finds where a pick ray meets a drag surface: the line point closest to the
 * ray, or the ray and plane intersection.
 *
 * @param surface Drag surface.
 * @param ray World pick ray.
 * @returns World hit point, or null when the ray misses the plane.
 */
export function componentDragSurfaceHit(surface: ComponentDragSurface, ray: THREE.Ray): THREE.Vector3 | null {
  if (surface.kind === 'plane') {
    return ray.intersectPlane(surface.plane, new THREE.Vector3());
  }
  const start = surface.origin.clone().addScaledVector(surface.direction, -COMPONENT_DRAG_LINE_HALF_LENGTH);
  const end = surface.origin.clone().addScaledVector(surface.direction, COMPONENT_DRAG_LINE_HALF_LENGTH);
  const pointOnLine = new THREE.Vector3();
  ray.distanceSqToSegment(start, end, undefined, pointOnLine);
  return pointOnLine;
}
