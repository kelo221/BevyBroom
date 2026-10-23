import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvBounds, FaceUvOperationContext, FaceUvPoint } from './face_uv_operation_context.js';
import type { FaceUvJustifySide } from './face_uv_operation_justify.js';

/** Default tolerance for face UV status queries. */
export const FACE_UV_STATUS_TOLERANCE = 0.001;

/** Axis queries available for fit status. */
export type FaceUvStatusAxis = 'u' | 'v';

/**
 * Read-only queries describing how a face's current UV matrix sits on the tile
 * grid; used to highlight fit, justify, and align state.
 */
export class FaceUvOperationStatus {
  /**
   * Reports whether a face's UV extent along one axis spans a whole number of
   * texture repeats with its minimum corner resting on a tile boundary.
   *
   * @param matrix Face UV matrix to inspect.
   * @param context Face polygon measured under the matrix.
   * @param axis Axis queried.
   * @param tolerance Maximum distance from the fitted state.
   * @returns True when the axis is fitted.
   */
  static isFaceFitted(
    matrix: SurfaceUvMatrix,
    context: FaceUvOperationContext,
    axis: FaceUvStatusAxis,
    tolerance: number = FACE_UV_STATUS_TOLERANCE,
  ): boolean {
    const bounds = context.uvBounds(matrix);
    const extent = axis === 'u' ? bounds.maxU - bounds.minU : bounds.maxV - bounds.minV;
    const repeatCount = Math.round(extent);
    if (repeatCount < 1 || Math.abs(extent - repeatCount) > tolerance) {
      return false;
    }
    const minValue = axis === 'u' ? bounds.minU : bounds.minV;
    return Math.abs(minValue - Math.round(minValue)) <= tolerance;
  }

  /**
   * Reports whether a face's outermost corner on one side rests on a tile
   * boundary, or its UV center on a half-tile center for the center side.
   *
   * @param matrix Face UV matrix to inspect.
   * @param context Face polygon measured under the matrix.
   * @param side Justify side queried.
   * @param tolerance Maximum distance from the justified state.
   * @returns True when the side is justified.
   */
  static isFaceJustified(
    matrix: SurfaceUvMatrix,
    context: FaceUvOperationContext,
    side: FaceUvJustifySide,
    tolerance: number = FACE_UV_STATUS_TOLERANCE,
  ): boolean {
    const bounds = context.uvBounds(matrix);
    if (side === 'left' || side === 'right') {
      return valueNearInteger(side === 'left' ? bounds.minU : bounds.maxU, tolerance);
    }
    if (side === 'bottom' || side === 'top') {
      return valueNearInteger(side === 'bottom' ? bounds.minV : bounds.maxV, tolerance);
    }
    return centerNearHalfTile(bounds, tolerance);
  }

  /**
   * Reports whether any polygon edge's UV direction runs along the U axis.
   *
   * @param matrix Face UV matrix to inspect.
   * @param context Face polygon whose edges are measured.
   * @param tolerance Maximum off-axis fraction of the edge direction.
   * @returns True when an edge is aligned with U.
   */
  static isFaceAligned(
    matrix: SurfaceUvMatrix,
    context: FaceUvOperationContext,
    tolerance: number = FACE_UV_STATUS_TOLERANCE,
  ): boolean {
    return context.faceEdgeUvDirections(matrix).some((direction) => edgeRunsAlongU(direction, tolerance));
  }
}

/**
 * Returns whether a UV value is within a tolerance of an integer.
 *
 * @param value Value to test.
 * @param tolerance Maximum distance to the nearest integer.
 * @returns True when near an integer.
 */
function valueNearInteger(value: number, tolerance: number): boolean {
  return Math.abs(value - Math.round(value)) <= tolerance;
}

/**
 * Returns whether both UV bounds centers sit on half-tile centers.
 *
 * @param bounds Face UV bounds.
 * @param tolerance Maximum distance to the nearest half-tile center.
 * @returns True when centered.
 */
function centerNearHalfTile(bounds: FaceUvBounds, tolerance: number): boolean {
  const centers: FaceUvPoint = { u: (bounds.minU + bounds.maxU) / 2, v: (bounds.minV + bounds.maxV) / 2 };
  return valueNearHalfTile(centers.u, tolerance) && valueNearHalfTile(centers.v, tolerance);
}

/**
 * Returns whether a UV value is within a tolerance of a half-tile center.
 *
 * @param value Value to test.
 * @param tolerance Maximum distance to the nearest half-tile center.
 * @returns True when near a half-tile center.
 */
function valueNearHalfTile(value: number, tolerance: number): boolean {
  return Math.abs(value - Math.round(value - 0.5) - 0.5) <= tolerance;
}

/**
 * Returns whether an edge UV direction is parallel to the U axis within a
 * tolerance fraction of its length.
 *
 * @param direction Edge UV direction (unnormalized).
 * @param tolerance Maximum absolute V fraction of the direction length.
 * @returns True when the edge runs along U.
 */
function edgeRunsAlongU(direction: FaceUvPoint, tolerance: number): boolean {
  const length = Math.hypot(direction.u, direction.v);
  if (length < 1e-12) {
    return false;
  }
  return Math.abs(direction.v) / length <= tolerance;
}
