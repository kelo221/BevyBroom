import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationAlignEdge } from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationAlignEdge', () => {
  it('rotates the edge closest to U onto the pure +U direction', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const bestEdgeIndex = findEdgeClosestToU(recipe.context.faceEdgeUvDirections(input));
      const aligned = new FaceUvOperationAlignEdge('best').apply(input, recipe.context);
      const alignedDirections = recipe.context.faceEdgeUvDirections(aligned);
      const chosen = alignedDirections[bestEdgeIndex];
      expect(chosen).toBeDefined();
      expect(chosen?.v).toBeCloseTo(0, 6);
      expect(chosen?.u).toBeGreaterThan(0);
    });
  });

  it('preserves offsets, scale magnitudes, and the plane normal', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const aligned = new FaceUvOperationAlignEdge('best').apply(input, recipe.context);
      expect(aligned.u.w).toBe(input.u.w);
      expect(aligned.v.w).toBe(input.v.w);
      expect(rowMagnitude(aligned.u)).toBeCloseTo(rowMagnitude(input.u), 9);
      expect(rowMagnitude(aligned.v)).toBeCloseTo(rowMagnitude(input.v), 9);
      expect(
        aligned.planeNormalAlignedTo(recipe.faceNormal).distanceTo(input.planeNormalAlignedTo(recipe.faceNormal)),
      ).toBeLessThan(1e-9);
    });
  });

  it('steps to the following or preceding edge from the aligned one', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const bestEdgeIndex = findEdgeClosestToU(recipe.context.faceEdgeUvDirections(input));
      const edgeCount = recipe.context.faceEdgeCount();
      const alignedOnce = new FaceUvOperationAlignEdge('best').apply(input, recipe.context);
      const next = new FaceUvOperationAlignEdge('next').apply(alignedOnce, recipe.context);
      const previous = new FaceUvOperationAlignEdge('previous').apply(alignedOnce, recipe.context);
      const nextDirection = recipe.context.faceEdgeUvDirections(next)[(bestEdgeIndex + 1) % edgeCount];
      const previousDirection =
        recipe.context.faceEdgeUvDirections(previous)[(bestEdgeIndex - 1 + edgeCount) % edgeCount];
      expect(nextDirection?.v).toBeCloseTo(0, 6);
      expect(nextDirection?.u).toBeGreaterThan(0);
      expect(previousDirection?.v).toBeCloseTo(0, 6);
      expect(previousDirection?.u).toBeGreaterThan(0);
    });
  });

  it('never mutates the input matrix', () => {
    const recipes = createSeededQuadRecipes(4);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      new FaceUvOperationAlignEdge('best').apply(input, recipe.context);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
    });
  });
});

/**
 * Finds the edge whose UV direction is most aligned with +U.
 *
 * @param directions UV direction per edge.
 * @returns Edge index of the best-aligned direction.
 */
function findEdgeClosestToU(directions: { u: number; v: number }[]): number {
  let bestIndex = 0;
  let bestScore = -Infinity;
  directions.forEach((direction, index) => {
    const score = direction.u / Math.hypot(direction.u, direction.v);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Measures the direction magnitude of a matrix row.
 *
 * @param row Matrix row.
 * @returns Row direction length.
 */
function rowMagnitude(row: { x: number; y: number; z: number }): number {
  return Math.hypot(row.x, row.y, row.z);
}
