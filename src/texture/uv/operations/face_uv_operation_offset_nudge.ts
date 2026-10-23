import * as THREE from 'three';
import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { FaceUvOperation } from './face_uv_operation.js';
import {
  faceUvRowDirection,
  faceUvRowMagnitude,
  resolveFaceUvHorizontalAxis,
  shiftFaceUvRowOffset,
} from './face_uv_operation_math.js';

/** Screen direction a nudge moves the texture toward. */
export type FaceUvNudgeDirection = 'left' | 'right' | 'up' | 'down';

/** Minimum absolute screen alignment for a nudge to move along an axis. */
const NUDGE_MIN_ALIGNMENT = 1e-6;

/**
 * Moves the texture across the face by a world-space step in a screen
 * direction. The texture axis reading as horizontal on screen (most aligned
 * with camera right, ties broken toward camera up) carries left/right input;
 * the other axis carries up/down input. The offset shift is chosen so the
 * visible texture moves with the input for both mirrored and unmirrored
 * scales.
 */
export class FaceUvOperationOffsetNudge extends FaceUvOperation {
  private readonly direction: FaceUvNudgeDirection;
  private readonly stepMeters: number;

  /**
   * Creates an offset nudge operation.
   *
   * @param direction Screen direction the texture visibly moves toward.
   * @param stepMeters Movement magnitude in world meters.
   */
  constructor(direction: FaceUvNudgeDirection, stepMeters: number) {
    super();
    this.direction = direction;
    this.stepMeters = stepMeters;
  }

  /**
   * Nudges one axis offset of the matrix.
   *
   * @param matrix Current UV matrix (never modified).
   * @param context Face context carrying camera directions.
   * @returns Nudged matrix, or the input when no camera is supplied, the step
   *   is zero/non-finite, or the axes cannot be resolved.
   */
  apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    if (!Number.isFinite(this.stepMeters) || Math.abs(this.stepMeters) < 1e-12) {
      return matrix;
    }
    const nudgeAxis = this.resolveNudgeAxis(matrix, context);
    if (!nudgeAxis) {
      return matrix;
    }
    const offsetShift = this.computeAxisOffsetShift(matrix, context, nudgeAxis);
    if (offsetShift === null) {
      return matrix;
    }
    return shiftFaceUvRowOffset(matrix, nudgeAxis, offsetShift);
  }

  /**
   * Resolves the texture axis this nudge moves along.
   *
   * @param matrix Current UV matrix.
   * @param context Face context carrying camera directions.
   * @returns Axis to shift, or null when the camera or axis choice is unusable.
   */
  private resolveNudgeAxis(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): 'u' | 'v' | null {
    if (!context.cameraRight) {
      return null;
    }
    const horizontalAxis = resolveFaceUvHorizontalAxis(matrix, context.cameraRight, context.cameraUp);
    if (!horizontalAxis) {
      return null;
    }
    if (this.direction === 'left' || this.direction === 'right') {
      return horizontalAxis;
    }
    return otherAxis(horizontalAxis);
  }

  /**
   * Computes the UV offset shift that visibly moves the texture by the step
   * toward this operation's screen direction along one axis.
   *
   * @param matrix Current UV matrix.
   * @param context Face context carrying camera directions.
   * @param axis Texture axis the nudge moves along.
   * @returns Offset shift in UV units, or null when the axis is perpendicular
   *   to the screen direction.
   */
  private computeAxisOffsetShift(
    matrix: SurfaceUvMatrix,
    context: FaceUvOperationContext,
    axis: 'u' | 'v',
  ): number | null {
    const screenDirection = this.resolveScreenDirection(context);
    if (!screenDirection) {
      return null;
    }
    const row = axis === 'u' ? matrix.u : matrix.v;
    const alignment = faceUvRowDirection(row).dot(screenDirection);
    if (Math.abs(alignment) < NUDGE_MIN_ALIGNMENT) {
      return null;
    }
    const inputSign = this.direction === 'right' || this.direction === 'up' ? 1 : -1;
    const worldStep = inputSign * this.stepMeters * Math.sign(alignment);
    return -worldStep * faceUvRowMagnitude(row);
  }

  /**
   * Resolves the world direction this operation's input points toward on
   * screen.
   *
   * @param context Face context carrying camera directions.
   * @returns Unit camera right for left/right input, unit camera up for up/down
   *   input, or null when the required vector is missing.
   */
  private resolveScreenDirection(context: FaceUvOperationContext): THREE.Vector3 | null {
    if (this.direction === 'left' || this.direction === 'right') {
      return context.cameraRight?.clone().normalize() ?? null;
    }
    return context.cameraUp?.clone().normalize() ?? null;
  }
}

/**
 * Returns the texture axis that is not the given one.
 *
 * @param axis Input axis.
 * @returns The other axis.
 */
function otherAxis(axis: 'u' | 'v'): 'u' | 'v' {
  return axis === 'u' ? 'v' : 'u';
}
