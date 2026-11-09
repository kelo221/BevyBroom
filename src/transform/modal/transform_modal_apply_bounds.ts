import * as THREE from 'three';
import type { BoundsFace } from '@/types/bounds_face.js';
import type { BoundsFaceResizeStep } from '@/transform/bounds/bounds_resize_steps.js';
import { boundsFaceAxisLetter } from '@/transform/bounds/handle/bounds_handle_faces.js';
import { TransformModalAxis } from './transform_modal_axis.js';
import { transformModalAxisWorldVector } from './transform_modal_axis_vector.js';

/**
 * Applies a typed distance as bounds face move (translation) along a modal
 * axis.
 *
 * @param objects Drag targets.
 * @param initialPositions Pre-drag positions.
 * @param value Typed distance.
 * @param axis Effective single axis.
 * @param orientation Gizmo orientation.
 * @param outDelta Optional vector to receive the applied world delta.
 * @returns True when applied.
 */
export function transformModalApplyBoundsMoveNumeric(
  objects: THREE.Object3D[],
  initialPositions: Map<THREE.Object3D, THREE.Vector3>,
  value: number,
  axis: TransformModalAxis,
  orientation: THREE.Quaternion,
  outDelta?: THREE.Vector3,
): boolean {
  const worldAxis = transformModalAxisWorldVector(axis, orientation);
  if (!worldAxis) {
    return false;
  }
  const delta = worldAxis.multiplyScalar(value);
  objects.forEach((object) => {
    const start = initialPositions.get(object);
    if (!start) return;
    object.position.copy(start).add(delta);
  });
  outDelta?.copy(delta);
  return true;
}

/** Faces of an active bounds resize drag and their last pointer travels. */
export interface TransformModalBoundsResizeFaces {
  /** Face the drag started on. */
  primaryFace: BoundsFace;
  /** Second face of a corner drag, or null for an edge drag. */
  secondaryFace: BoundsFace | null;
  /** Last pointer travel of the primary face along its normal. */
  primaryPointerDelta: number;
  /** Last pointer travel of the secondary face along its normal. */
  secondaryPointerDelta: number;
}

/**
 * Builds the resize steps for a typed distance. An edge drag moves its face by
 * the value. A corner drag with an axis lock moves the face on that axis by the
 * value and keeps the other face at its last pointer travel; without a lock on
 * one of its axes both faces move by the value.
 *
 * @param faces Faces of the drag and their last pointer travels.
 * @param value Typed travel along the outward normal.
 * @param axis Keyboard axis lock.
 * @returns Steps to apply.
 */
export function transformModalBoundsResizeStepsBuild(
  faces: TransformModalBoundsResizeFaces,
  value: number,
  axis: TransformModalAxis,
): BoundsFaceResizeStep[] {
  const secondaryFace = faces.secondaryFace;
  if (!secondaryFace) {
    return [{ face: faces.primaryFace, deltaAlongNormal: value }];
  }
  const locksPrimary = axis === boundsFaceAxisLetter(faces.primaryFace);
  const locksSecondary = axis === boundsFaceAxisLetter(secondaryFace);
  const unlocked = !locksPrimary && !locksSecondary;
  return [
    { face: faces.primaryFace, deltaAlongNormal: locksPrimary || unlocked ? value : faces.primaryPointerDelta },
    { face: secondaryFace, deltaAlongNormal: locksSecondary || unlocked ? value : faces.secondaryPointerDelta },
  ];
}
