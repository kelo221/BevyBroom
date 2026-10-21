import * as THREE from 'three';

/**
 * Smallest |cos| between a ray and a plane or line that still counts as
 * crossing.
 */
const OBJECT_DRAG_RAY_PARALLEL_EPSILON = 1e-6;

/**
 * Intersects a ray with an infinite plane, accepting hits behind the ray origin
 * so orthographic rays starting inside the scene still resolve.
 *
 * @param ray World ray with a unit direction.
 * @param planePoint Any point on the plane.
 * @param planeNormal Plane normal (any length above zero).
 * @returns New intersection point, or null when the ray is parallel.
 */
export function objectDragRayPlaneIntersect(
  ray: THREE.Ray,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3,
): THREE.Vector3 | null {
  const unitNormal = planeNormal.clone().normalize();
  const denominator = ray.direction.dot(unitNormal);
  if (Math.abs(denominator) < OBJECT_DRAG_RAY_PARALLEL_EPSILON) {
    return null;
  }
  const distanceAlongRay = planePoint.clone().sub(ray.origin).dot(unitNormal) / denominator;
  return ray.origin.clone().addScaledVector(ray.direction, distanceAlongRay);
}

/**
 * Finds the parameter on an infinite line closest to a ray (the line point is
 * linePoint + lineDirection * parameter).
 *
 * @param ray World ray with a unit direction.
 * @param linePoint Any point on the line.
 * @param lineDirection Unit direction of the line.
 * @returns Line parameter, or null when ray and line are parallel.
 */
export function objectDragRayLineClosestParameter(
  ray: THREE.Ray,
  linePoint: THREE.Vector3,
  lineDirection: THREE.Vector3,
): number | null {
  const originOffset = ray.origin.clone().sub(linePoint);
  const directionsDot = ray.direction.dot(lineDirection);
  const denominator = 1 - directionsDot * directionsDot;
  if (denominator < OBJECT_DRAG_RAY_PARALLEL_EPSILON) {
    return null;
  }
  const rayOffsetDot = ray.direction.dot(originOffset);
  const lineOffsetDot = lineDirection.dot(originOffset);
  return (lineOffsetDot - directionsDot * rayOffsetDot) / denominator;
}
