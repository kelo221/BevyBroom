import * as THREE from 'three';
import {
  objectDragRayLineClosestParameter,
  objectDragRayPlaneIntersect,
} from '@/tools/object_drag/object_drag_ray_math.js';

/** How a move phase constrains the pointer: onto a plane or along a line. */
export type ObjectDragMoveConstraintKind = 'plane' | 'line';

/**
 * One stretch of a selection move where the pointer is projected onto a fixed
 * plane or line. Deltas are measured from where the pointer was when the phase
 * began, so starting a new phase never makes the selection jump.
 */
export class ObjectDragMovePhase {
  private readonly constraintKind: ObjectDragMoveConstraintKind;
  private readonly anchorPoint: THREE.Vector3;
  private readonly axis: THREE.Vector3;
  private readonly startPoint: THREE.Vector3;
  private readonly rejectHitsBehindRay: boolean;

  /**
   * Begins a phase at the point where a ray meets the constraint.
   *
   * @param constraintKind Plane or line constraint.
   * @param anchorPoint Point the plane or line passes through.
   * @param axis Plane normal or line direction.
   * @param beginRay Pick ray at the moment the phase begins.
   * @param rejectHitsBehindRay True to ignore plane hits behind the ray origin.
   * @returns New phase, or null when the ray cannot meet the constraint.
   */
  static phaseBegin(
    constraintKind: ObjectDragMoveConstraintKind,
    anchorPoint: THREE.Vector3,
    axis: THREE.Vector3,
    beginRay: THREE.Ray,
    rejectHitsBehindRay: boolean,
  ): ObjectDragMovePhase | null {
    const unitAxis = axis.clone().normalize();
    const startPoint = ObjectDragMovePhase.constraintPointAt(constraintKind, anchorPoint, unitAxis, beginRay);
    if (!startPoint || (rejectHitsBehindRay && ObjectDragMovePhase.pointBehindRay(startPoint, beginRay))) {
      return null;
    }
    return new ObjectDragMovePhase(constraintKind, anchorPoint.clone(), unitAxis, startPoint, rejectHitsBehindRay);
  }

  /**
   * Stores the phase constraint and start point.
   *
   * @param constraintKind Plane or line constraint.
   * @param anchorPoint Point the plane or line passes through.
   * @param axis Unit plane normal or line direction.
   * @param startPoint Constraint point where the phase began.
   * @param rejectHitsBehindRay True to ignore plane hits behind the ray origin.
   */
  private constructor(
    constraintKind: ObjectDragMoveConstraintKind,
    anchorPoint: THREE.Vector3,
    axis: THREE.Vector3,
    startPoint: THREE.Vector3,
    rejectHitsBehindRay: boolean,
  ) {
    this.constraintKind = constraintKind;
    this.anchorPoint = anchorPoint;
    this.axis = axis;
    this.startPoint = startPoint;
    this.rejectHitsBehindRay = rejectHitsBehindRay;
  }

  /**
   * Returns the constraint kind of this phase.
   *
   * @returns Plane or line.
   */
  kind(): ObjectDragMoveConstraintKind {
    return this.constraintKind;
  }

  /**
   * Returns the world offset from the phase start to where a ray meets the
   * constraint.
   *
   * @param ray Current pick ray.
   * @returns New delta, or null when the ray misses the constraint.
   */
  deltaAt(ray: THREE.Ray): THREE.Vector3 | null {
    const point = ObjectDragMovePhase.constraintPointAt(this.constraintKind, this.anchorPoint, this.axis, ray);
    if (!point || (this.rejectHitsBehindRay && ObjectDragMovePhase.pointBehindRay(point, ray))) {
      return null;
    }
    return point.sub(this.startPoint);
  }

  /**
   * Projects a ray onto a plane or line constraint.
   *
   * @param constraintKind Plane or line constraint.
   * @param anchorPoint Point the plane or line passes through.
   * @param unitAxis Unit plane normal or line direction.
   * @param ray Pick ray.
   * @returns New constraint point, or null when the ray is parallel.
   */
  private static constraintPointAt(
    constraintKind: ObjectDragMoveConstraintKind,
    anchorPoint: THREE.Vector3,
    unitAxis: THREE.Vector3,
    ray: THREE.Ray,
  ): THREE.Vector3 | null {
    if (constraintKind === 'plane') {
      return objectDragRayPlaneIntersect(ray, anchorPoint, unitAxis);
    }
    const parameter = objectDragRayLineClosestParameter(ray, anchorPoint, unitAxis);
    return parameter === null ? null : anchorPoint.clone().addScaledVector(unitAxis, parameter);
  }

  /**
   * Returns whether a point lies behind the ray origin.
   *
   * @param point World point.
   * @param ray Pick ray.
   * @returns True when the point is behind the ray.
   */
  private static pointBehindRay(point: THREE.Vector3, ray: THREE.Ray): boolean {
    return point.clone().sub(ray.origin).dot(ray.direction) <= 0;
  }
}
