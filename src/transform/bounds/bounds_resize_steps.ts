import * as THREE from 'three';
import type { BoundsFace } from '@/types/bounds_face.js';
import {
  cloneOrientedBounds,
  getBoundsFaceHalfExtent,
  getBoundsFaceLocalNormal,
  type DataOrientedBounds,
} from './builder_oriented_bounds.js';
import {
  computeOneSidedMeshResize,
  computeOneSidedMultiMeshResize,
  resolveAppliedBoundsFaceDelta,
  type MeshBoundsResizeResult,
} from './bounds_resize_math.js';

/** One face of a bounds resize and how far it travels along its outward normal. */
export interface BoundsFaceResizeStep {
  /** Face being dragged. */
  face: BoundsFace;
  /** Signed travel of the face along its outward normal. */
  deltaAlongNormal: number;
}

/**
 * Returns the bounds after one face travels along its normal while the opposite
 * face stays fixed.
 *
 * @param bounds Bounds before the step.
 * @param step Face and travel to apply.
 * @param minHalfExtent Minimum half-extent after resize.
 * @returns New independent bounds.
 */
export function boundsResizeStepApplyToBounds(
  bounds: DataOrientedBounds,
  step: BoundsFaceResizeStep,
  minHalfExtent: number,
): DataOrientedBounds {
  const appliedDelta = resolveAppliedBoundsFaceDelta(bounds, step.face, step.deltaAlongNormal, minHalfExtent);
  const localNormal = getBoundsFaceLocalNormal(step.face);
  const worldNormal = localNormal.clone().applyQuaternion(bounds.quaternion).normalize();
  const resized = cloneOrientedBounds(bounds);
  resized.center.addScaledVector(worldNormal, appliedDelta * 0.5);
  const grownHalf = getBoundsFaceHalfExtent(bounds.halfExtents, step.face) + appliedDelta * 0.5;
  const axisMask = new THREE.Vector3(Math.abs(localNormal.x), Math.abs(localNormal.y), Math.abs(localNormal.z));
  resized.halfExtents.multiply(new THREE.Vector3(1, 1, 1).sub(axisMask)).addScaledVector(axisMask, grownHalf);
  return resized;
}

/**
 * Computes the pose of one object after a resize that moves one face (edge
 * handle) or two faces on different axes (corner handle). Each step keeps its
 * opposite face fixed, so a corner drag keeps the opposite corner in place.
 *
 * @param startPosition Object position at drag start.
 * @param startScale Object scale at drag start.
 * @param startBounds Bounds at drag start.
 * @param steps Faces and travels to apply, in order.
 * @param isMultiObject True when resizing a multi-object selection frame.
 * @param minHalfExtent Minimum half-extent after resize.
 * @returns New position and scale.
 */
export function boundsResizeStepsApplyToObject(
  startPosition: THREE.Vector3,
  startScale: THREE.Vector3,
  startBounds: DataOrientedBounds,
  steps: readonly BoundsFaceResizeStep[],
  isMultiObject: boolean,
  minHalfExtent: number,
): MeshBoundsResizeResult {
  let result: MeshBoundsResizeResult = { position: startPosition.clone(), scale: startScale.clone() };
  let bounds = startBounds;
  steps.forEach((step) => {
    result = boundsResizeStepApplyToPose(result, bounds, step, isMultiObject, minHalfExtent);
    bounds = boundsResizeStepApplyToBounds(bounds, step, minHalfExtent);
  });
  return result;
}

/**
 * Writes the resize result onto every object from its drag-start pose. Objects
 * without a recorded start pose stay untouched.
 *
 * @param objects Dragged objects.
 * @param startPositions Position of each object at drag start.
 * @param startScales Scale of each object at drag start.
 * @param startBounds Bounds at drag start.
 * @param steps Faces and travels to apply, in order.
 * @param minHalfExtent Minimum half-extent after resize.
 */
export function boundsResizeStepsApplyToObjects(
  objects: readonly THREE.Object3D[],
  startPositions: ReadonlyMap<THREE.Object3D, THREE.Vector3>,
  startScales: ReadonlyMap<THREE.Object3D, THREE.Vector3>,
  startBounds: DataOrientedBounds,
  steps: readonly BoundsFaceResizeStep[],
  minHalfExtent: number,
): void {
  const isMultiObject = objects.length > 1;
  for (const object of objects) {
    const startPosition = startPositions.get(object);
    const startScale = startScales.get(object);
    if (!startPosition || !startScale) {
      continue;
    }
    const result = boundsResizeStepsApplyToObject(
      startPosition,
      startScale,
      startBounds,
      steps,
      isMultiObject,
      minHalfExtent,
    );
    object.position.copy(result.position);
    object.scale.copy(result.scale);
  }
}

/**
 * Applies one resize step to an object pose.
 *
 * @param pose Object pose before the step.
 * @param bounds Bounds before the step.
 * @param step Face and travel to apply.
 * @param isMultiObject True when resizing a multi-object selection frame.
 * @param minHalfExtent Minimum half-extent after resize.
 * @returns Object pose after the step.
 */
function boundsResizeStepApplyToPose(
  pose: MeshBoundsResizeResult,
  bounds: DataOrientedBounds,
  step: BoundsFaceResizeStep,
  isMultiObject: boolean,
  minHalfExtent: number,
): MeshBoundsResizeResult {
  if (isMultiObject) {
    return computeOneSidedMultiMeshResize(
      pose.position,
      pose.scale,
      bounds,
      step.face,
      step.deltaAlongNormal,
      minHalfExtent,
    );
  }
  return computeOneSidedMeshResize(pose.position, pose.scale, bounds, step.face, step.deltaAlongNormal, minHalfExtent);
}

/**
 * Returns the face travel each step really applies after the minimum size
 * clamp.
 *
 * @param startBounds Bounds at drag start.
 * @param steps Requested faces and travels.
 * @param minHalfExtent Minimum half-extent after resize.
 * @returns Applied travel per step, in step order.
 */
export function boundsResizeStepsAppliedDeltas(
  startBounds: DataOrientedBounds,
  steps: readonly BoundsFaceResizeStep[],
  minHalfExtent: number,
): number[] {
  return steps.map((step) =>
    resolveAppliedBoundsFaceDelta(startBounds, step.face, step.deltaAlongNormal, minHalfExtent),
  );
}
