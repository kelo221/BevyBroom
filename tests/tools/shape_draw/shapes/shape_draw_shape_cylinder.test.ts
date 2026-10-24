import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeCylinder } from '@/tools/shape_draw/shapes/shape_draw_shape_cylinder.js';
import {
  expectShapeTestBoxInside,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves cylinders build as one convex prism, or one wedge per side hollow. */
describe('ShapeDrawShapeCylinder', () => {
  const bounds = shapeTestBoundsCreate([-2, -1, -1.5], [2, 3, 1.5]);

  it('builds one valid convex prism when solid', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCylinder(), bounds, { sides: 8 });
    expect(pieces).toHaveLength(1);
    expectShapeTestPiecesValid(pieces);
  });

  it('doubles the ring point count across both end faces', () => {
    const sides = 6;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCylinder(), bounds, { sides });
    expect(pieces[0]).toHaveLength(sides * 2);
  });

  it('builds one valid convex wedge per side when hollow', () => {
    const sides = 7;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCylinder(), bounds, {
      sides,
      hollow: 'on',
      wallThickness: 0.4,
    });
    expect(pieces).toHaveLength(sides);
    expectShapeTestPiecesValid(pieces);
  });

  it('runs along the requested axis instead of the default Y axis', () => {
    const sides = 5;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCylinder(), bounds, { sides, axis: 'x' });
    const union = shapeTestPiecesBoundsCreate(pieces);
    expectShapeTestBoxInside(union, bounds);
    expect(union.min.x).toBeCloseTo(bounds.min.x, 4);
    expect(union.max.x).toBeCloseTo(bounds.max.x, 4);
    expectShapeTestPiecesValid(pieces);
  });

  it('aligns the first side by an edge by default and by a vertex on request', () => {
    const shape = new ShapeDrawShapeCylinder();
    const radiusX = (bounds.max.x - bounds.min.x) * 0.5;
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const halfStep = Math.PI / 4;
    const edgePieces = shapeTestPiecesCreate(shape, bounds, { sides: 4, circleType: 'edge' });
    const vertexPieces = shapeTestPiecesCreate(shape, bounds, { sides: 4, circleType: 'vertex' });
    const distanceOf = (pieces: THREE.Vector3[][]): number[] =>
      (pieces[0] ?? []).slice(0, 4).map((point) => Math.abs(point.x - centerX));
    expect(Math.max(...distanceOf(edgePieces))).toBeCloseTo(radiusX * Math.cos(halfStep), 4);
    expect(Math.max(...distanceOf(vertexPieces))).toBeCloseTo(radiusX, 4);
  });

  it('describes sides, circle type, axis, hollow and wall thickness', () => {
    const descriptors = new ShapeDrawShapeCylinder().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
      'sides',
      'circleType',
      'axis',
      'hollow',
      'wallThickness',
    ]);
  });
});
