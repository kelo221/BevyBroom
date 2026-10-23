import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeCuboid } from '@/tools/shape_draw/shapes/shape_draw_shape_cuboid.js';
import {
  expectShapeTestBoxesClose,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Proves the cuboid fills its bounds with one valid convex piece. */
describe('ShapeDrawShapeCuboid', () => {
  it('builds one valid convex piece filling the bounds exactly', () => {
    const bounds = shapeTestBoundsCreate([-2, 0.5, 1], [3, 2.5, 4]);
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCuboid(), bounds);
    expect(pieces).toHaveLength(1);
    expectShapeTestPiecesValid(pieces);
    expectShapeTestBoxesClose(shapeTestPiecesBoundsCreate(pieces), bounds);
  });

  it('lists no parameters and exposes a stable id, label and icon', () => {
    const shape = new ShapeDrawShapeCuboid();
    expect(shape.id).toBe('cuboid');
    expect(shape.label).toBe('Cuboid');
    expect(shape.icon).toBe('cube-outline');
    expect(shape.parameterDescriptors()).toEqual([]);
  });

  it('reports one box piece independent of parameter values', () => {
    const bounds = shapeTestBoundsCreate([0, 0, 0], [1, 1, 1]);
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeCuboid(), bounds, { anything: 3 });
    expect(pieces[0]).toHaveLength(8);
    for (const point of pieces[0] ?? []) {
      expect(point instanceof THREE.Vector3).toBe(true);
    }
  });
});
