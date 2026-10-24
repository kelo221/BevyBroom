import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeCone } from '@/tools/shape_draw/shapes/shape_draw_shape_cone.js';
import {
  expectShapeTestBoxInside,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves cones build as one convex hull over a ring base and an apex. */
describe('ShapeDrawShapeCone', () => {
  const bounds = shapeTestBoundsCreate([-2, -1, -1.5], [2, 3, 1.5]);

  it('builds one valid convex piece of ring points plus the apex', () => {
    const sides = 7;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCone(), bounds, { sides });
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(sides + 1);
    expectShapeTestPiecesValid(pieces);
  });

  it('places the base ring at the negative axis end and the apex at the far end', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCone(), bounds, { sides: 6 });
    const points = pieces[0] ?? [];
    const apex = points[points.length - 1];
    expect(apex?.y).toBeCloseTo(bounds.max.y, 4);
    for (const point of points.slice(0, -1)) {
      expect(point.y).toBeCloseTo(bounds.min.y, 4);
    }
  });

  it('runs along the requested axis instead of the default Y axis', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCone(), bounds, { sides: 5, axis: 'z' });
    expectShapeTestPiecesValid(pieces);
    const pieceBounds = shapeTestPiecesBoundsCreate(pieces);
    expectShapeTestBoxInside(pieceBounds, bounds);
    expect(pieceBounds.min.z).toBeCloseTo(bounds.min.z, 4);
    expect(pieceBounds.max.z).toBeCloseTo(bounds.max.z, 4);
    const points = pieces[0] ?? [];
    expect(points[points.length - 1]?.z).toBeCloseTo(bounds.max.z, 4);
  });

  it('describes sides, circle type and axis', () => {
    const descriptors = new ShapeDrawShapeCone().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['sides', 'circleType', 'axis']);
  });
});
