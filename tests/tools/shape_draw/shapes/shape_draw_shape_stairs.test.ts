import { describe, expect, it } from 'vitest';
import {
  SHAPE_DRAW_STAIRS_DEFAULT_STEP_HEIGHT,
  ShapeDrawShapeStairs,
} from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';
import {
  expectShapeTestBoxInside,
  expectShapeTestBoxesClose,
  expectShapeTestPiecesValid,
  shapeTestBoundsCreate,
  shapeTestBoundsFromPointsCreate,
  shapeTestPiecesBoundsCreate,
  shapeTestPiecesCreate,
} from './shape_draw_shape_test_helpers.js';

/** Derives the expected step count from bounds height and step height. */
function expectStepCount(height: number, stepHeight: number): number {
  return Math.max(1, Math.ceil(height / stepHeight - 1e-9));
}

/** Proves stairs split into equal-tread box steps spanning the bounds. */
describe('ShapeDrawShapeStairs', () => {
  const boundsHeight = 3;
  const bounds = shapeTestBoundsCreate([0, 0, 0], [6, boundsHeight, 2]);

  it('creates one valid convex step per ceil(height / stepHeight)', () => {
    const stepHeight = 0.5;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds, { stepHeight });
    expect(pieces).toHaveLength(expectStepCount(boundsHeight, stepHeight));
    expectShapeTestPiecesValid(pieces);
  });

  it('uses the default step height when no parameter is stored', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds);
    expect(pieces).toHaveLength(expectStepCount(boundsHeight, SHAPE_DRAW_STAIRS_DEFAULT_STEP_HEIGHT));
  });

  it('grows treads along +X from the minimum corner with every step spanning the floor', () => {
    const stepHeight = 1;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds, { stepHeight });
    const runLength = bounds.max.x - bounds.min.x;
    const stepCount = expectStepCount(boundsHeight, stepHeight);
    const tread = runLength / stepCount;
    pieces.forEach((piece, index) => {
      const pieceBounds = shapeTestBoundsFromPointsCreate(piece);
      expect(pieceBounds.min.x).toBeCloseTo(bounds.min.x + index * tread, 4);
      expect(pieceBounds.max.x).toBeCloseTo(bounds.min.x + (index + 1) * tread, 4);
      expect(pieceBounds.min.y).toBeCloseTo(bounds.min.y, 4);
      expect(pieceBounds.max.y).toBeCloseTo(bounds.min.y + ((index + 1) * boundsHeight) / stepCount, 4);
      expect(pieceBounds.min.z).toBeCloseTo(bounds.min.z, 4);
      expect(pieceBounds.max.z).toBeCloseTo(bounds.max.z, 4);
    });
  });

  it('runs the treads along -X when the direction parameter is -x', () => {
    const stepHeight = 1;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds, { stepHeight, direction: '-x' });
    const runLength = bounds.max.x - bounds.min.x;
    const stepCount = expectStepCount(boundsHeight, stepHeight);
    const tread = runLength / stepCount;
    pieces.forEach((piece, index) => {
      const pieceBounds = shapeTestBoundsFromPointsCreate(piece);
      expect(pieceBounds.max.x).toBeCloseTo(bounds.max.x - index * tread, 4);
      expect(pieceBounds.min.x).toBeCloseTo(bounds.max.x - (index + 1) * tread, 4);
    });
  });

  it('runs the treads along Z when the direction parameter is +z', () => {
    const stepHeight = 1;
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds, { stepHeight, direction: '+z' });
    const stepCount = expectStepCount(boundsHeight, stepHeight);
    expect(pieces).toHaveLength(stepCount);
    const union = shapeTestPiecesBoundsCreate(pieces);
    expect(union.min.z).toBeCloseTo(bounds.min.z, 4);
    expect(union.max.z).toBeCloseTo(bounds.max.z, 4);
  });

  it('keeps every step inside the drawn bounds', () => {
    const pieces = shapeTestPiecesCreate(new ShapeDrawShapeStairs(), bounds, { stepHeight: 0.7, direction: '-z' });
    expectShapeTestBoxInside(shapeTestPiecesBoundsCreate(pieces), bounds);
    expectShapeTestBoxesClose(shapeTestPiecesBoundsCreate(pieces), bounds);
  });

  it('describes the step height and direction parameters', () => {
    const descriptors = new ShapeDrawShapeStairs().parameterDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['stepHeight', 'direction']);
  });
});
