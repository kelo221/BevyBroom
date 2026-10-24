import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeSpheroidUv } from '@/tools/shape_draw/shapes/shape_draw_shape_spheroid_uv.js';
import {
  expectShapeTestBoxInside,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves the UV spheroid builds one convex hull of a latitude/longitude grid. */
describe('ShapeDrawShapeSpheroidUv', () => {
  const bounds = shapeTestBoundsCreate([-2, -1.5, -1], [2, 1.5, 1]);

  it('builds one valid convex piece from both poles and every interior ring', () => {
    const rings = 5;
    const sides = 6;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidUv(), bounds, { rings, sides });
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(2 + (rings - 1) * sides);
    expectShapeTestPiecesValid(pieces);
  });

  it('places the poles on the up axis bounds and the equator on the center', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidUv(), bounds, { rings: 4, sides: 4 });
    const points = pieces[0] ?? [];
    expect(points[0]?.y).toBeCloseTo(bounds.max.y, 4);
    expect(points[points.length - 1]?.y).toBeCloseTo(bounds.min.y, 4);
    const equator = points.slice(1, -1).filter((point) => Math.abs(point.y) < 1e-6);
    expect(equator.length).toBeGreaterThan(0);
  });

  it('keeps the grid inside the bounds with the poles touching the extremes', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidUv(), bounds, { rings: 6, sides: 8 });
    const pieceBounds = shapeTestPiecesBoundsCreate(pieces);
    expectShapeTestBoxInside(pieceBounds, bounds);
    expect(pieceBounds.min.y).toBeCloseTo(bounds.min.y, 4);
    expect(pieceBounds.max.y).toBeCloseTo(bounds.max.y, 4);
  });

  it('describes the ring and side counts', () => {
    const descriptors = new ShapeDrawShapeSpheroidUv().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['rings', 'sides']);
  });
});
