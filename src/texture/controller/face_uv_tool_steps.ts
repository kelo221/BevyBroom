/** Modifier state of a face UV tool invocation. */
export interface FaceUvToolModifiers {
  shift: boolean;
  ctrl: boolean;
}

/** Fine offset nudge step in world meters (Ctrl). */
export const FACE_UV_NUDGE_FINE_STEP_METERS = 0.01;

/** Fine rotation step in degrees (Ctrl). */
export const FACE_UV_ROTATE_FINE_STEP_DEGREES = 1;

/** Coarse rotation step in degrees (Shift). */
export const FACE_UV_ROTATE_COARSE_STEP_DEGREES = 90;

/**
 * Resolves the world-space offset nudge step for a modifier state: the grid
 * interval by default, twice the grid with Shift, one centimeter with Ctrl.
 *
 * @param gridInterval Current translation snap interval in meters.
 * @param modifiers Modifier state of the invocation.
 * @returns Step in world meters.
 */
export function faceUvNudgeStepResolve(gridInterval: number, modifiers: FaceUvToolModifiers): number {
  if (modifiers.ctrl) {
    return FACE_UV_NUDGE_FINE_STEP_METERS;
  }
  if (modifiers.shift) {
    return gridInterval * 2;
  }
  return gridInterval;
}

/**
 * Resolves the rotation step in degrees for a modifier state: the grid rotation
 * snap by default, 90 degrees with Shift, one degree with Ctrl.
 *
 * @param gridRotationDegrees Current rotation snap step in degrees.
 * @param modifiers Modifier state of the invocation.
 * @returns Step in degrees.
 */
export function faceUvRotateStepResolve(gridRotationDegrees: number, modifiers: FaceUvToolModifiers): number {
  if (modifiers.ctrl) {
    return FACE_UV_ROTATE_FINE_STEP_DEGREES;
  }
  if (modifiers.shift) {
    return FACE_UV_ROTATE_COARSE_STEP_DEGREES;
  }
  return gridRotationDegrees;
}
