import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeSpheroidIcosahedron } from '@/tools/shape_draw/shapes/shape_draw_shape_spheroid_icosahedron.js';
import { ShapeDrawIcospherePoints } from '@/tools/shape_draw/shapes/shape_draw_shape_icosphere.js';
import {
  expectShapeTestBoxesClose,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves the icosahedron spheroid builds one convex hull of icosphere points. */
describe('ShapeDrawShapeSpheroidIcosahedron', () => {
  const bounds = shapeTestBoundsCreate([-2, -1.5, -1], [2, 1.5, 1]);

  it('builds one valid convex piece from the subdivided icosahedron points', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidIcosahedron(), bounds, { subdivision: 1 });
    expect(pieces).toHaveLength(1);
    expectShapeTestPiecesValid(pieces);
  });

  it('scales the unit icosphere cloud into the drawn bounds', () => {
    const subdivision = 2;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidIcosahedron(), bounds, { subdivision });
    expect(pieces[0]).toHaveLength(ShapeDrawIcospherePoints.create(subdivision).length);
    expectShapeTestBoxesClose(shapeTestPiecesBoundsCreate(pieces), bounds);
  });

  it('adds mid-edge vertices once per edge during subdivision', () => {
    const baseCount = ShapeDrawIcospherePoints.create(0).length;
    const subdividedCount = ShapeDrawIcospherePoints.create(1).length;
    expect(baseCount).toBe(12);
    expect(subdividedCount).toBe(42);
  });

  it('clamps the subdivision level to the accepted range', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeSpheroidIcosahedron(), bounds, { subdivision: 99 });
    expect(pieces[0]).toHaveLength(ShapeDrawIcospherePoints.create(4).length);
  });

  it('describes the subdivision parameter', () => {
    const descriptors = new ShapeDrawShapeSpheroidIcosahedron().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['subdivision']);
  });
});
