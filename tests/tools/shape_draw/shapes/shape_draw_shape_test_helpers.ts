import * as THREE from 'three';
import { expect } from 'vitest';
import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import type { ShapeDrawShape } from '@/tools/shape_draw/shapes/shape_draw_shape.js';
import type { ShapeDrawShapeParameterValues } from '@/tools/shape_draw/shapes/shape_draw_shape_parameter.js';

/**
 * Builds an axis-aligned bounds box from a minimum and maximum corner.
 *
 * @param minimum Minimum corner components.
 * @param maximum Maximum corner components.
 * @returns Bounds box.
 */
export function shapeTestBoundsCreate(
  minimum: [number, number, number],
  maximum: [number, number, number],
): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(...minimum), new THREE.Vector3(...maximum));
}

/**
 * Builds the pieces of a shape inside bounds.
 *
 * @param shape Shape to build.
 * @param bounds Bounds the shape must fit into.
 * @param parameters Parameter values keyed by parameter id.
 * @param upAxis Axis pointing up in the request frame.
 * @returns Convex point sets.
 */
export function shapeTestPiecesCreate(
  shape: ShapeDrawShape,
  bounds: THREE.Box3,
  parameters: ShapeDrawShapeParameterValues = {},
  upAxis: 'x' | 'y' | 'z' = 'y',
): THREE.Vector3[][] {
  return shape.piecesCreate({ bounds, parameters, upAxis });
}

/**
 * Asserts every piece closes into a valid convex solid brush.
 *
 * @param pieces Convex point sets.
 */
export function expectShapeTestPiecesValid(pieces: THREE.Vector3[][]): void {
  expect(pieces.length).toBeGreaterThan(0);
  for (const piece of pieces) {
    const brush = solidHullBrushFromPoints(piece);
    expect(brush, 'piece hull closes').not.toBeNull();
    if (!brush) {
      return;
    }
    const validation = SolidBrushValidator.validate(brush);
    expect(validation.errors, validation.errors.join('; ')).toEqual([]);
    expect(validation.valid).toBe(true);
  }
}

/**
 * Returns the union bounds of point sets.
 *
 * @param pieces Point sets.
 * @returns Union bounds.
 */
export function shapeTestPiecesBoundsCreate(pieces: THREE.Vector3[][]): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const piece of pieces) {
    bounds.union(shapeTestBoundsFromPointsCreate(piece));
  }
  return bounds;
}

/**
 * Builds the bounds of one point set.
 *
 * @param points Points to enclose.
 * @returns Bounds of the points.
 */
export function shapeTestBoundsFromPointsCreate(points: THREE.Vector3[]): THREE.Box3 {
  return new THREE.Box3().setFromPoints(points);
}

/**
 * Asserts a measured box matches an expected box within a tolerance.
 *
 * @param actual Measured box.
 * @param expected Expected box.
 */
export function expectShapeTestBoxesClose(actual: THREE.Box3, expected: THREE.Box3): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(actual.min[axis]).toBeCloseTo(expected.min[axis], 4);
    expect(actual.max[axis]).toBeCloseTo(expected.max[axis], 4);
  }
}

/**
 * Asserts one box lies inside another.
 *
 * @param inner Measured box.
 * @param outer Bounds that must contain the measured box.
 */
export function expectShapeTestBoxInside(inner: THREE.Box3, outer: THREE.Box3): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(inner.min[axis]).toBeGreaterThanOrEqual(outer.min[axis] - 1e-6);
    expect(inner.max[axis]).toBeLessThanOrEqual(outer.max[axis] + 1e-6);
  }
}
