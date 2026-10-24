import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext, FaceUvPoint } from './face_uv_operation_context.js';

/** Where a UV-space transform anchors itself on the face. */
export type FaceUvPivotMode = 'uv-center' | 'face-centroid';

/**
 * Linear map applied to UV coordinates: u' = a·u + b·v + shift, v' = c·u + d·v.
 *
 * - Shift.
 */
export interface FaceUvRowLinearCoefficients {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Absolute alignment difference below which two axis alignments count as tied. */
const CAMERA_ALIGNMENT_TIE_EPSILON = 1e-6;

/** Minimum UV extent treated as non-degenerate for scaling operations. */
const UV_EXTENT_MIN = 1e-9;

/**
 * Resolves the UV-space pivot a transform anchors around.
 *
 * @param matrix Surface UV matrix the face is measured under.
 * @param context Face polygon the pivot is derived from.
 * @param mode Which pivot anchor to use.
 * @returns Pivot UV point.
 */
export function resolveFaceUvPivot(
  matrix: SurfaceUvMatrix,
  context: FaceUvOperationContext,
  mode: FaceUvPivotMode,
): FaceUvPoint {
  if (mode === 'face-centroid') {
    return context.worldCentroidUv(matrix);
  }
  return context.uvBoundsCenter(matrix);
}

/**
 * Applies a linear map to the UV coordinates of a matrix, anchored so the pivot
 * UV point stays fixed. Rows combine as U' = a·U + b·V and V' = c·U + d·V with
 * offsets compensated for the pivot.
 *
 * @param matrix Source matrix (not modified).
 * @param coefficients Linear map coefficients.
 * @param pivot UV point held fixed by the map.
 * @returns New matrix with mapped rows.
 */
export function combineFaceUvRowsAboutUvPivot(
  matrix: SurfaceUvMatrix,
  coefficients: FaceUvRowLinearCoefficients,
  pivot: FaceUvPoint,
): SurfaceUvMatrix {
  const shiftU = pivot.u - coefficients.a * pivot.u - coefficients.b * pivot.v;
  const shiftV = pivot.v - coefficients.c * pivot.u - coefficients.d * pivot.v;
  return new SurfaceUvMatrix(
    combineRows(matrix.u, matrix.v, coefficients.a, coefficients.b, shiftU),
    combineRows(matrix.u, matrix.v, coefficients.c, coefficients.d, shiftV),
  );
}

/**
 * Combines the U row and V row into one output row with an offset shift.
 *
 * @param uRow U row of the source matrix.
 * @param vRow V row of the source matrix.
 * @param firstCoefficient Multiplier on the U row.
 * @param secondCoefficient Multiplier on the V row.
 * @param shift Added to the combined offset component.
 * @returns Combined row.
 */
function combineRows(
  uRow: THREE.Vector4,
  vRow: THREE.Vector4,
  firstCoefficient: number,
  secondCoefficient: number,
  shift: number,
): THREE.Vector4 {
  return new THREE.Vector4(
    firstCoefficient * uRow.x + secondCoefficient * vRow.x,
    firstCoefficient * uRow.y + secondCoefficient * vRow.y,
    firstCoefficient * uRow.z + secondCoefficient * vRow.z,
    firstCoefficient * uRow.w + secondCoefficient * vRow.w + shift,
  );
}

/**
 * Returns the unit world direction along which a matrix row's UV coordinate
 * increases.
 *
 * @param row Matrix row (xyz direction, w offset).
 * @returns Unit direction, or the zero vector for a degenerate row.
 */
export function faceUvRowDirection(row: THREE.Vector4): THREE.Vector3 {
  const direction = new THREE.Vector3(row.x, row.y, row.z);
  if (direction.lengthSq() < 1e-20) {
    return direction;
  }
  return direction.normalize();
}

/**
 * Measures the magnitude of a matrix row's direction (UV units per world
 * meter).
 *
 * @param row Matrix row.
 * @returns Row magnitude.
 */
export function faceUvRowMagnitude(row: THREE.Vector4): number {
  return Math.hypot(row.x, row.y, row.z);
}

/**
 * Adds a shift to one row's offset component, leaving all directions and the
 * other row untouched.
 *
 * @param matrix Source matrix (not modified).
 * @param axis Row whose offset changes.
 * @param shift Offset delta in UV units.
 * @returns New matrix with the shifted offset.
 */
export function shiftFaceUvRowOffset(matrix: SurfaceUvMatrix, axis: 'u' | 'v', shift: number): SurfaceUvMatrix {
  if (axis === 'u') {
    return new SurfaceUvMatrix(new THREE.Vector4(matrix.u.x, matrix.u.y, matrix.u.z, matrix.u.w + shift), matrix.v);
  }
  return new SurfaceUvMatrix(matrix.u, new THREE.Vector4(matrix.v.x, matrix.v.y, matrix.v.z, matrix.v.w + shift));
}

/** Which boundary of the tile grid a value is snapped onto. */
export type FaceUvTileBoundaryMode = 'below' | 'above' | 'center';

/**
 * Distance from a tile boundary below which a value counts as already on it, so
 * repeated anchoring never steps a whole tile from float noise.
 */
const TILE_BOUNDARY_SNAP_EPSILON = 1e-9;

/**
 * Computes the shift that lands a UV value on a tile boundary: the boundary at
 * or below the value, at or above it, or the half-tile center between them.
 * Values within a small epsilon of a boundary count as already on it.
 *
 * @param value Current UV value.
 * @param mode Which boundary to land on.
 * @returns Shift to add to the value.
 */
export function faceUvTileBoundaryShift(value: number, mode: FaceUvTileBoundaryMode): number {
  if (mode === 'above') {
    return Math.ceil(value - TILE_BOUNDARY_SNAP_EPSILON) - value;
  }
  if (mode === 'center') {
    return Math.floor(value + TILE_BOUNDARY_SNAP_EPSILON) + 0.5 - value;
  }
  return Math.floor(value + TILE_BOUNDARY_SNAP_EPSILON) - value;
}

/**
 * Returns exact cosine/sine for an angle that is a whole multiple of 90
 * degrees, so quarter turns compose without floating-point drift.
 *
 * @param degrees Rotation angle in degrees.
 * @returns Exact unit values, or null when the angle is not a quarter-turn
 *   multiple.
 */
export function faceUvExactQuarterTurnCosSin(degrees: number): { cosine: number; sine: number } | null {
  const quarterSteps = Math.round(degrees / 90);
  if (Math.abs(degrees - quarterSteps * 90) > 1e-9) {
    return null;
  }
  const exactTable = [
    { cosine: 1, sine: 0 },
    { cosine: 0, sine: 1 },
    { cosine: -1, sine: 0 },
    { cosine: 0, sine: -1 },
  ];
  return exactTable[((quarterSteps % 4) + 4) % 4] ?? null;
}

/**
 * Returns whether the V row direction is strictly more aligned with a camera
 * right direction than the U row direction (texture seen sideways).
 *
 * @param matrix Matrix whose rows are compared.
 * @param cameraRight Camera right direction (normalized internally).
 * @returns True when the V axis is the more camera-horizontal axis.
 */
export function isFaceUvVAxisMoreCameraRightAligned(matrix: SurfaceUvMatrix, cameraRight: THREE.Vector3): boolean {
  const cameraDirection = cameraRight.clone().normalize();
  const uAlignment = Math.abs(faceUvRowDirection(matrix.u).dot(cameraDirection));
  const vAlignment = Math.abs(faceUvRowDirection(matrix.v).dot(cameraDirection));
  return vAlignment > uAlignment;
}

/**
 * Picks the texture axis that reads as horizontal on screen: the row more
 * aligned with camera right, ties broken toward the row less aligned with
 * camera up.
 *
 * @param matrix Matrix whose rows are compared.
 * @param cameraRight Camera right direction.
 * @param cameraUp Camera up direction used for tie-breaks; a tie without it
 *   resolves to null.
 * @returns 'u' or 'v', or null when the axes tie on both directions.
 */
export function resolveFaceUvHorizontalAxis(
  matrix: SurfaceUvMatrix,
  cameraRight: THREE.Vector3,
  cameraUp: THREE.Vector3 | undefined,
): 'u' | 'v' | null {
  const right = cameraRight.clone().normalize();
  const uAlignment = Math.abs(faceUvRowDirection(matrix.u).dot(right));
  const vAlignment = Math.abs(faceUvRowDirection(matrix.v).dot(right));
  if (Math.abs(uAlignment - vAlignment) > CAMERA_ALIGNMENT_TIE_EPSILON) {
    return uAlignment > vAlignment ? 'u' : 'v';
  }
  return resolveTiedHorizontalAxis(matrix, cameraUp);
}

/**
 * Breaks a camera-right alignment tie using camera up: the row more aligned
 * with camera up counts as the vertical axis.
 *
 * @param matrix Matrix whose rows are compared.
 * @param cameraUp Camera up direction.
 * @returns The horizontal axis, or null when the tie persists.
 */
function resolveTiedHorizontalAxis(matrix: SurfaceUvMatrix, cameraUp: THREE.Vector3 | undefined): 'u' | 'v' | null {
  if (!cameraUp) {
    return null;
  }
  const up = cameraUp.clone().normalize();
  const uAlignment = Math.abs(faceUvRowDirection(matrix.u).dot(up));
  const vAlignment = Math.abs(faceUvRowDirection(matrix.v).dot(up));
  if (Math.abs(uAlignment - vAlignment) <= CAMERA_ALIGNMENT_TIE_EPSILON) {
    return null;
  }
  return uAlignment < vAlignment ? 'u' : 'v';
}

/**
 * Computes the scale factor that makes a UV extent span an exact repeat count.
 *
 * @param extent Current UV extent along one axis.
 * @param repeatCount Whole repeats the extent must span.
 * @returns Positive scale factor, or null when the extent is degenerate.
 */
export function faceUvFitScaleFactor(extent: number, repeatCount: number): number | null {
  if (extent <= UV_EXTENT_MIN) {
    return null;
  }
  return repeatCount / extent;
}

/**
 * Sanitizes a fit repeat count: non-finite values and counts at or below zero
 * become one repeat.
 *
 * @param repeatCount Requested repeat count.
 * @returns Safe repeat count of at least one.
 */
export function sanitizeFaceUvRepeatCount(repeatCount: number): number {
  if (!Number.isFinite(repeatCount) || repeatCount <= 0) {
    return 1;
  }
  return repeatCount;
}
