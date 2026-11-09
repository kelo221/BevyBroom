import * as THREE from 'three';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { NotificationGlobal } from '@/audio/notification/notification_global.js';
import { resolveMinimumBoundsHalfExtent, snapBoundsFaceDelta } from './bounds_resize_math.js';
import {
  boundsResizeStepsAppliedDeltas,
  boundsResizeStepsApplyToObjects,
  type BoundsFaceResizeStep,
} from './bounds_resize_steps.js';

/**
 * Writes bounds resizes of the active drag session onto the dragged objects and
 * raises snap feedback when the applied size steps. Handles edge drags (one
 * face) and corner drags (the active face plus a secondary face).
 */
export class BoundsResizeApplier {
  private readonly session: TransformDragSession;
  private readonly transformExecutor: TransformExecutor;
  private lastRaisedAppliedDeltas: number[] | null;

  /**
   * Creates a resize applier for a drag session.
   *
   * @param session Shared drag session holding faces, start bounds and poses.
   * @param transformExecutor Executor whose grid snap drives snapping and
   *   limits.
   */
  constructor(session: TransformDragSession, transformExecutor: TransformExecutor) {
    this.session = session;
    this.transformExecutor = transformExecutor;
    this.lastRaisedAppliedDeltas = null;
  }

  /**
   * Builds the resize steps for the session's active face and, for a corner
   * drag, its secondary face.
   *
   * @param primaryDelta Travel of the active face along its normal.
   * @param secondaryDelta Travel of the secondary face along its normal.
   * @returns Steps to apply; empty when no resize is active.
   */
  stepsBuild(primaryDelta: number, secondaryDelta: number): BoundsFaceResizeStep[] {
    const primaryFace = this.session.activeBoundsFace;
    if (!primaryFace) {
      return [];
    }
    const steps: BoundsFaceResizeStep[] = [{ face: primaryFace, deltaAlongNormal: primaryDelta }];
    const secondaryFace = this.session.secondaryBoundsFace;
    if (secondaryFace) {
      steps.push({ face: secondaryFace, deltaAlongNormal: secondaryDelta });
    }
    return steps;
  }

  /**
   * Writes absolute resize results onto every dragged object.
   *
   * @param objects Dragged objects.
   * @param steps Faces and travels to apply.
   */
  objectsResize(objects: THREE.Object3D[], steps: readonly BoundsFaceResizeStep[]): void {
    const startBounds = this.session.startBounds;
    if (!startBounds || steps.length === 0) {
      return;
    }
    boundsResizeStepsApplyToObjects(
      objects,
      this.session.initialPositions,
      this.session.initialScales,
      startBounds,
      steps,
      this.minimumHalfExtentResolve(),
    );
  }

  /**
   * Snaps a face travel when grid snap is enabled.
   *
   * @param rawDelta Unsnapped travel along a face normal.
   * @returns Snapped or raw travel.
   */
  deltaSnap(rawDelta: number): number {
    const gridSnap = this.transformExecutor.getGridSnap();
    return snapBoundsFaceDelta(rawDelta, gridSnap.isEnabled(), gridSnap.getInterval());
  }

  /** Clears snap-step tracking so the next applied resize can raise audio. */
  snapStepTrackingClear(): void {
    this.lastRaisedAppliedDeltas = null;
  }

  /**
   * Raises snap-resize audio when the clamped applied travel of any step
   * changes. Requested steps past the minimum size do not raise.
   *
   * @param steps Requested faces and travels after grid snap.
   */
  snapStepAudioRaiseIfStepped(steps: readonly BoundsFaceResizeStep[]): void {
    const startBounds = this.session.startBounds;
    if (!this.transformExecutor.getGridSnap().isEnabled() || !startBounds || steps.length === 0) {
      return;
    }
    const appliedDeltas = boundsResizeStepsAppliedDeltas(startBounds, steps, this.minimumHalfExtentResolve());
    if (!this.appliedDeltasStepped(appliedDeltas)) {
      return;
    }
    this.lastRaisedAppliedDeltas = appliedDeltas;
    NotificationGlobal.onSelectionResizedWithSnapping(Math.max(...appliedDeltas.map((delta) => Math.abs(delta))));
  }

  /**
   * Returns the minimum half-extent for the current grid snap state.
   *
   * @returns Minimum half-extent along a resized axis.
   */
  minimumHalfExtentResolve(): number {
    const gridSnap = this.transformExecutor.getGridSnap();
    return resolveMinimumBoundsHalfExtent(gridSnap.isEnabled(), gridSnap.getInterval());
  }

  /**
   * Returns whether applied travels differ from the last raised ones.
   *
   * @param appliedDeltas Applied travel per step.
   * @returns True when the geometry changes relative to the last raise.
   */
  private appliedDeltasStepped(appliedDeltas: readonly number[]): boolean {
    const previous = this.lastRaisedAppliedDeltas;
    if (!previous || previous.length !== appliedDeltas.length) {
      return appliedDeltas.some((delta) => Math.abs(delta) > 1e-12);
    }
    return appliedDeltas.some((delta, index) => Math.abs(delta - (previous[index] ?? 0)) > 1e-12);
  }
}
