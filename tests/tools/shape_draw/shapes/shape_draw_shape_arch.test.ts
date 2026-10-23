import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeArch } from '@/tools/shape_draw/shapes/shape_draw_shape_arch.js';
import {
  expectShapeTestBoxesClose,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestBoundsFromPointsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves the arch ring spans the longer horizontal axis of its bounds. */
describe('ShapeDrawShapeArch', () => {
  const bounds = shapeTestBoundsCreate([-3, 0, -0.5], [3, 3, 0.5]);

  it('creates one valid convex wedge per side', () => {
    const sides = 6;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), bounds, { sides });
    expect(pieces).toHaveLength(sides);
    expectShapeTestPiecesValid(pieces);
  });

  it('adds convex spandrel pieces when spandrel fill is on', () => {
    const sides = 6;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), bounds, { sides, spandrelFill: 'on' });
    expect(pieces.length).toBeGreaterThan(sides);
    expectShapeTestPiecesValid(pieces);
    expectShapeTestBoxesClose(shapeTestPiecesBoundsCreate(pieces), bounds);
  });

  it('keeps every wedge inside the drawn bounds', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), bounds, { sides: 5, thickness: 0.8 });
    for (const piece of pieces) {
      const pieceBounds = shapeTestBoundsFromPointsCreate(piece);
      expect(pieceBounds.min.y).toBeGreaterThanOrEqual(bounds.min.y - 1e-6);
      expect(pieceBounds.max.y).toBeLessThanOrEqual(bounds.max.y + 1e-6);
      expect(pieceBounds.min.x).toBeGreaterThanOrEqual(bounds.min.x - 1e-6);
      expect(pieceBounds.max.x).toBeLessThanOrEqual(bounds.max.x + 1e-6);
    }
  });

  it('springs from the floor with the outer arc meeting the bounds sides', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), bounds, { sides: 8 });
    const union = shapeTestPiecesBoundsCreate(pieces);
    expect(union.min.x).toBeCloseTo(bounds.min.x, 4);
    expect(union.max.x).toBeCloseTo(bounds.max.x, 4);
    expect(union.max.y).toBeCloseTo(bounds.max.y, 4);
    expect(union.min.y).toBeCloseTo(bounds.min.y, 4);
    expect(union.min.z).toBeCloseTo(bounds.min.z, 4);
    expect(union.max.z).toBeCloseTo(bounds.max.z, 4);
  });

  it('spans the longer horizontal axis and extrudes across the shorter one', () => {
    const tallBounds = shapeTestBoundsCreate([0, 0, -4], [2, 5, 2]);
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), tallBounds, { sides: 4 });
    const union = shapeTestPiecesBoundsCreate(pieces);
    expect(union.min.z).toBeCloseTo(tallBounds.min.z, 4);
    expect(union.max.z).toBeCloseTo(tallBounds.max.z, 4);
  });

  it('leaves an opening narrowed by the wall thickness at the spring line', () => {
    const sides = 8;
    const thickness = 1;
    const spanRadius = (bounds.max.x - bounds.min.x) * 0.5;
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeArch(), bounds, { sides, thickness });
    const springDistances = pieces
      .flat()
      .filter((point) => Math.abs(point.y - bounds.min.y) < 1e-6)
      .map((point) => Math.abs(point.x - centerX));
    expect(Math.min(...springDistances)).toBeCloseTo(spanRadius - thickness, 4);
    expect(Math.max(...springDistances)).toBeCloseTo(spanRadius, 4);
  });

  it('describes sides, thickness and spandrel parameters', () => {
    const descriptors = new ShapeDrawShapeArch().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['sides', 'thickness', 'spandrelFill']);
  });
});
