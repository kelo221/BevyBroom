import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationFit } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationFit', () => {
  it('fits one repeat across the chosen axis with the min corner on a tile boundary', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const fitted = new FaceUvOperationFit({ axis: 'u' }).apply(input, recipe.context);
      const bounds = recipe.context.uvBounds(fitted);
      expect(bounds.maxU - bounds.minU).toBeCloseTo(1, 6);
      expect(bounds.minU).toBeCloseTo(Math.round(bounds.minU), 6);
    });
  });

  it('fits both axes at once', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const fitted = new FaceUvOperationFit().apply(input, recipe.context);
      const bounds = recipe.context.uvBounds(fitted);
      expect(bounds.maxU - bounds.minU).toBeCloseTo(1, 6);
      expect(bounds.maxV - bounds.minV).toBeCloseTo(1, 6);
      expect(bounds.minU).toBeCloseTo(Math.round(bounds.minU), 6);
      expect(bounds.minV).toBeCloseTo(Math.round(bounds.minV), 6);
    });
  });

  it('fits an explicit repeat count larger than one', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const repeatCount = 3;
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const fitted = new FaceUvOperationFit({ axis: 'both', repeatCount }).apply(input, recipe.context);
      const bounds = recipe.context.uvBounds(fitted);
      expect(bounds.maxU - bounds.minU).toBeCloseTo(repeatCount, 6);
      expect(bounds.maxV - bounds.minV).toBeCloseTo(repeatCount, 6);
    });
  });

  it('preserves the mirror sign of each axis scale', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const fitted = new FaceUvOperationFit().apply(input, recipe.context);
      const before = input.decompose(recipe.faceNormal);
      const after = fitted.decompose(recipe.faceNormal);
      expect(Math.sign(after.scaleU)).toBe(Math.sign(before.scaleU));
      expect(Math.sign(after.scaleV)).toBe(Math.sign(before.scaleV));
    });
  });

  it('keeps row directions and never mutates the input matrix', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      const fitted = new FaceUvOperationFit().apply(input, recipe.context);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
      const directionDot = fitted.u.x * input.u.x + fitted.u.y * input.u.y + fitted.u.z * input.u.z;
      expect(directionDot).toBeGreaterThan(0);
    });
  });

  it('treats a non-positive repeat count as a single repeat', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) {
      throw new Error('test factory produced no recipe');
    }
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    const fitted = new FaceUvOperationFit({ repeatCount: 0 }).apply(input, recipe.context);
    const bounds = recipe.context.uvBounds(fitted);
    expect(bounds.maxU - bounds.minU).toBeCloseTo(1, 6);
  });
});
