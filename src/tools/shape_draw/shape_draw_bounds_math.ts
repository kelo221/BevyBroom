import * as THREE from 'three';

/** One local box axis (X = grid U, Y = grid normal, Z = grid V). */
export type ShapeDrawAxis = 'x' | 'y' | 'z';

/** Every local axis in order. */
export const SHAPE_DRAW_AXES: readonly ShapeDrawAxis[] = ['x', 'y', 'z'];

/** Extent below which a box axis counts as flat. */
const SHAPE_DRAW_FLAT_EPSILON = 1e-6;

/** Fraction of a grid step tolerated as rounding noise when snapping outward. */
const SHAPE_DRAW_SNAP_EPSILON = 1e-6;

/** Inputs for a box drawn as a footprint on a horizontal grid-local plane. */
export interface ShapeDrawFootprintRequest {
  /** Local drag start (its Y is the footprint plane height). */
  startLocal: THREE.Vector3;
  /** Local point under the pointer on the footprint plane. */
  cornerLocal: THREE.Vector3;
  /** Local Y of the opposite box face, or null for a flat footprint. */
  heightLocal: number | null;
  /** True to force equal X and Z extents. */
  squareFootprint: boolean;
  /** Grid step length. */
  gridStep: number;
  /** True to snap the box outward to grid lines. */
  snapEnabled: boolean;
  /** Local direction flat axes grow toward (negative component grows down). */
  growDirectionLocal: THREE.Vector3;
}

/** Inputs for a box drawn as a rectangle in a 2D view plane. */
export interface ShapeDrawViewRectangleRequest {
  /** Local drag start. */
  startLocal: THREE.Vector3;
  /** Local point under the pointer. */
  cornerLocal: THREE.Vector3;
  /** Local axis pointing into the screen. */
  depthAxis: ShapeDrawAxis;
  /** Local minimum along the depth axis. */
  depthMin: number;
  /** Local maximum along the depth axis. */
  depthMax: number;
  /** True to force equal visible side lengths. */
  equalSides: boolean;
  /** Grid step length. */
  gridStep: number;
  /** True to snap the visible rectangle outward to grid lines. */
  snapEnabled: boolean;
}

/**
 * Snaps a range outward: the minimum down and the maximum up to grid lines.
 *
 * @param minimum Range minimum.
 * @param maximum Range maximum.
 * @param gridStep Grid step length (above zero).
 * @returns Snapped range.
 */
export function shapeDrawRangeSnapOutward(
  minimum: number,
  maximum: number,
  gridStep: number,
): { minimum: number; maximum: number } {
  return {
    minimum: Math.floor(minimum / gridStep + SHAPE_DRAW_SNAP_EPSILON) * gridStep,
    maximum: Math.ceil(maximum / gridStep - SHAPE_DRAW_SNAP_EPSILON) * gridStep,
  };
}

/**
 * Moves a corner so two axes span the same length from the start, keeping each
 * axis's drag direction (a zero offset counts as positive).
 *
 * @param startLocal Drag start.
 * @param cornerLocal Drag corner (not modified).
 * @param firstAxis First equalized axis.
 * @param secondAxis Second equalized axis.
 * @returns New equalized corner.
 */
export function shapeDrawCornerEqualize(
  startLocal: THREE.Vector3,
  cornerLocal: THREE.Vector3,
  firstAxis: ShapeDrawAxis,
  secondAxis: ShapeDrawAxis,
): THREE.Vector3 {
  const firstOffset = cornerLocal[firstAxis] - startLocal[firstAxis];
  const secondOffset = cornerLocal[secondAxis] - startLocal[secondAxis];
  const sideLength = Math.max(Math.abs(firstOffset), Math.abs(secondOffset));
  const equalized = cornerLocal.clone();
  equalized[firstAxis] = startLocal[firstAxis] + shapeDrawSignNonZero(firstOffset) * sideLength;
  equalized[secondAxis] = startLocal[secondAxis] + shapeDrawSignNonZero(secondOffset) * sideLength;
  return equalized;
}

/**
 * Returns -1 for negative values and +1 otherwise.
 *
 * @param value Signed value.
 * @returns Sign that never is zero.
 */
export function shapeDrawSignNonZero(value: number): number {
  return value < 0 ? -1 : 1;
}

/**
 * Grows every flat axis of a box by one grid step toward the grow direction.
 *
 * @param box Box to modify in place.
 * @param gridStep Grid step length.
 * @param growDirectionLocal Direction whose component sign picks the grown
 *   side.
 */
export function shapeDrawBoxGrowFlatAxes(box: THREE.Box3, gridStep: number, growDirectionLocal: THREE.Vector3): void {
  for (const axis of SHAPE_DRAW_AXES) {
    if (box.max[axis] - box.min[axis] > SHAPE_DRAW_FLAT_EPSILON) {
      continue;
    }
    if (growDirectionLocal[axis] < -SHAPE_DRAW_FLAT_EPSILON) {
      box.min[axis] = box.max[axis] - gridStep;
      continue;
    }
    box.max[axis] = box.min[axis] + gridStep;
  }
}

/**
 * Snaps the listed axes of a box outward to grid lines.
 *
 * @param box Box to modify in place.
 * @param axes Axes to snap.
 * @param gridStep Grid step length.
 */
export function shapeDrawBoxSnapOutward(box: THREE.Box3, axes: readonly ShapeDrawAxis[], gridStep: number): void {
  for (const axis of axes) {
    const snapped = shapeDrawRangeSnapOutward(box.min[axis], box.max[axis], gridStep);
    box.min[axis] = snapped.minimum;
    box.max[axis] = snapped.maximum;
  }
}

/**
 * Builds the local box for a footprint drag: the footprint spans start to
 * corner on the start plane, the height runs to the optional height plane, flat
 * axes grow one grid step and the result snaps outward.
 *
 * @param request Footprint drag inputs.
 * @returns New local box.
 */
export function shapeDrawBoxFromFootprint(request: ShapeDrawFootprintRequest): THREE.Box3 {
  const corner = request.squareFootprint
    ? shapeDrawCornerEqualize(request.startLocal, request.cornerLocal, 'x', 'z')
    : request.cornerLocal.clone();
  corner.y = request.heightLocal ?? request.startLocal.y;
  const box = new THREE.Box3().setFromPoints([request.startLocal, corner]);
  shapeDrawBoxGrowFlatAxes(box, request.gridStep, request.growDirectionLocal);
  if (request.snapEnabled) {
    shapeDrawBoxSnapOutward(box, SHAPE_DRAW_AXES, request.gridStep);
  }
  return box;
}

/**
 * Builds the local box for a 2D view drag: the visible rectangle spans start to
 * corner and snaps outward, the depth range comes from the request.
 *
 * @param request View rectangle drag inputs.
 * @returns New local box.
 */
export function shapeDrawBoxFromViewRectangle(request: ShapeDrawViewRectangleRequest): THREE.Box3 {
  const planeAxes = shapeDrawAxesOtherThan(request.depthAxis);
  const corner = request.equalSides
    ? shapeDrawCornerEqualize(request.startLocal, request.cornerLocal, planeAxes[0], planeAxes[1])
    : request.cornerLocal.clone();
  const box = new THREE.Box3().setFromPoints([request.startLocal, corner]);
  box.min[request.depthAxis] = Math.min(request.depthMin, request.depthMax);
  box.max[request.depthAxis] = Math.max(request.depthMin, request.depthMax);
  shapeDrawBoxGrowFlatAxes(box, request.gridStep, new THREE.Vector3(1, 1, 1));
  if (request.snapEnabled) {
    shapeDrawBoxSnapOutward(box, planeAxes, request.gridStep);
  }
  return box;
}

/**
 * Returns the two axes that differ from the given axis.
 *
 * @param excludedAxis Axis to leave out.
 * @returns Remaining axes in X, Y, Z order.
 */
export function shapeDrawAxesOtherThan(excludedAxis: ShapeDrawAxis): [ShapeDrawAxis, ShapeDrawAxis] {
  if (excludedAxis === 'x') {
    return ['y', 'z'];
  }
  if (excludedAxis === 'y') {
    return ['x', 'z'];
  }
  return ['x', 'y'];
}

/**
 * Returns the axis with the largest absolute component.
 *
 * @param localDirection Local direction.
 * @returns Dominant axis.
 */
export function shapeDrawDominantAxis(localDirection: THREE.Vector3): ShapeDrawAxis {
  const absoluteX = Math.abs(localDirection.x);
  const absoluteY = Math.abs(localDirection.y);
  const absoluteZ = Math.abs(localDirection.z);
  if (absoluteX >= absoluteY && absoluteX >= absoluteZ) {
    return 'x';
  }
  return absoluteY >= absoluteZ ? 'y' : 'z';
}

/**
 * Returns whether a box encloses a non-zero volume.
 *
 * @param box Box to test.
 * @returns True when every axis has a positive extent.
 */
export function shapeDrawBoxHasVolume(box: THREE.Box3): boolean {
  if (box.isEmpty()) {
    return false;
  }
  return SHAPE_DRAW_AXES.every((axis) => box.max[axis] - box.min[axis] > SHAPE_DRAW_FLAT_EPSILON);
}
