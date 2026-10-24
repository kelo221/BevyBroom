import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationRotate } from '@/texture/uv/operations/face_uv_operation_rotate.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationRotate', () => {
  it('restores the exact input after four quarter turns', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const rotated = rotateTimes(input, recipe.context, 90, 4);
      expect(rotated.equals(input, 1e-9)).toBe(true);
      const rotatedBack = rotateTimes(input, recipe.context, -90, 4);
      expect(rotatedBack.equals(input, 1e-9)).toBe(true);
    });
  });

  it('maps the U row onto the old V row for a +90 degree turn', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const rotated = new FaceUvOperationRotate(90).apply(input, recipe.context);
      expect(rowDot(rotated, input, 'u', 'v')).toBeGreaterThan(0);
      expect(rowDot(rotated, input, 'v', 'u')).toBeLessThan(0);
      expect(rowMagnitude(rotated.u)).toBeCloseTo(rowMagnitude(input.v), 9);
      expect(rowMagnitude(rotated.v)).toBeCloseTo(rowMagnitude(input.u), 9);
    });
  });

  it('keeps the pivot UV fixed for arbitrary angles about the face centroid', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const centroidBefore = recipe.context.worldCentroidUv(input);
      const rotated = new FaceUvOperationRotate(37, 'face-centroid').apply(input, recipe.context);
      const centroidAfter = recipe.context.worldCentroidUv(rotated);
      expect(centroidAfter.u).toBeCloseTo(centroidBefore.u, 9);
      expect(centroidAfter.v).toBeCloseTo(centroidBefore.v, 9);
    });
  });

  it('keeps the UV bounds center fixed for quarter turns about the UV center', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const centerBefore = recipe.context.uvBoundsCenter(input);
      const rotated = new FaceUvOperationRotate(90, 'uv-center').apply(input, recipe.context);
      const centerAfter = recipe.context.uvBoundsCenter(rotated);
      expect(centerAfter.u).toBeCloseTo(centerBefore.u, 9);
      expect(centerAfter.v).toBeCloseTo(centerBefore.v, 9);
    });
  });

  it('preserves the plane normal and never mutates the input', () => {
    const recipes = createSeededQuadRecipes(4);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      const rotated = new FaceUvOperationRotate(45).apply(input, recipe.context);
      expect(
        rotated.planeNormalAlignedTo(recipe.faceNormal).distanceTo(input.planeNormalAlignedTo(recipe.faceNormal)),
      ).toBeLessThan(1e-9);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
    });
  });
});

/**
 * Applies a rotation operation a number of times.
 *
 * @param input Starting matrix.
 * @param context Face context for the rotation.
 * @param degrees Rotation per step.
 * @param times Step count.
 * @returns Matrix after all steps.
 */
function rotateTimes(
  input: SurfaceUvMatrix,
  context: FaceUvOperationContext,
  degrees: number,
  times: number,
): SurfaceUvMatrix {
  let current = input;
  for (let step = 0; step < times; step++) {
    current = new FaceUvOperationRotate(degrees).apply(current, context);
  }
  return current;
}

/**
 * Computes the direction dot product of one row between two matrices.
 *
 * @param a First matrix.
 * @param b Second matrix.
 * @param rowA Row of the first matrix.
 * @param rowB Row of the second matrix.
 * @returns Direction dot product.
 */
function rowDot(a: SurfaceUvMatrix, b: SurfaceUvMatrix, rowA: 'u' | 'v', rowB: 'u' | 'v'): number {
  const first = rowA === 'u' ? a.u : a.v;
  const second = rowB === 'u' ? b.u : b.v;
  return first.x * second.x + first.y * second.y + first.z * second.z;
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
