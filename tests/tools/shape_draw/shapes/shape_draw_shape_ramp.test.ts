import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeRamp } from '@/tools/shape_draw/shapes/shape_draw_shape_ramp.js';
import {
  expectShapeTestBoxesClose,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/**
 * Returns the highest up coordinate of the points lying at one end of the
 * travel axis.
 *
 * @param points Ramp corner points.
 * @param travelAxis Axis the ramp climbs along.
 * @param end Travel coordinate of the end.
 * @returns Highest up coordinate at that end.
 */
function rampEndTopRead(points: THREE.Vector3[], travelAxis: 'x' | 'z', end: number): number {
  const atEnd = points.filter((point) => Math.abs(point[travelAxis] - end) < 1e-6);
  return Math.max(...atEnd.map((point) => point.y));
}

/**
 * Proves the ramp is one convex wedge filling the bounds and climbing toward
 * its direction.
 */
describe('ShapeDrawShapeRamp', () => {
  const bounds = shapeTestBoundsCreate([0, 0, 0], [4, 2, 2]);

  it('creates one valid convex wedge filling the bounds', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeRamp(), bounds);
    expect(pieces).toHaveLength(1);
    expectShapeTestPiecesValid(pieces);
    expectShapeTestBoxesClose(new THREE.Box3().setFromPoints(pieces[0] ?? []), bounds);
  });

  it('climbs from the floor at the minimum end to the full height at the maximum end for +x', () => {
    const points = shapeTestPiecesCreate(new ShapeDrawShapeRamp(), bounds, { direction: '+x' })[0] ?? [];
    expect(rampEndTopRead(points, 'x', bounds.min.x)).toBeCloseTo(bounds.min.y, 6);
    expect(rampEndTopRead(points, 'x', bounds.max.x)).toBeCloseTo(bounds.max.y, 6);
  });

  it('climbs toward the minimum end for -z', () => {
    const points = shapeTestPiecesCreate(new ShapeDrawShapeRamp(), bounds, { direction: '-z' })[0] ?? [];
    expect(rampEndTopRead(points, 'z', bounds.max.z)).toBeCloseTo(bounds.min.y, 6);
    expect(rampEndTopRead(points, 'z', bounds.min.z)).toBeCloseTo(bounds.max.y, 6);
  });

  it('raises the low end by lowHeight and stays a valid convex brush', () => {
    const lowHeight = 0.5;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeRamp(), bounds, { lowHeight });
    expectShapeTestPiecesValid(pieces);
    expect(rampEndTopRead(pieces[0] ?? [], 'x', bounds.min.x)).toBeCloseTo(bounds.min.y + lowHeight, 6);
  });

  it('caps lowHeight at the bounds height', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeRamp(), bounds, { lowHeight: 99 });
    expect(rampEndTopRead(pieces[0] ?? [], 'x', bounds.min.x)).toBeCloseTo(bounds.max.y, 6);
  });

  it('returns no pieces for flat bounds', () => {
    expect(shapeTestPiecesCreate(new ShapeDrawShapeRamp(), shapeTestBoundsCreate([0, 1, 0], [4, 1, 2]))).toEqual([]);
  });
});
