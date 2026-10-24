import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationScale } from '@/texture/uv/operations/face_uv_operation_scale.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationScale', () => {
  it('multiplies one axis scale and keeps the pivot UV fixed', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const factor = 2.5;
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const scaled = new FaceUvOperationScale(factor, 1).apply(input, recipe.context);
      const centerBefore = recipe.context.uvBoundsCenter(input);
      const centerAfter = recipe.context.uvBoundsCenter(scaled);
      expect(centerAfter.u).toBeCloseTo(centerBefore.u, 9);
      expect(centerAfter.v).toBeCloseTo(centerBefore.v, 9);
      const extentBefore = recipe.context.uvBounds(input);
      const extentAfter = recipe.context.uvBounds(scaled);
      expect(extentAfter.maxU - extentAfter.minU).toBeCloseTo((extentBefore.maxU - extentBefore.minU) * factor, 9);
      expect(extentAfter.maxV - extentAfter.minV).toBeCloseTo(extentBefore.maxV - extentBefore.minV, 9);
    });
  });

  it('scales both axes about the face centroid when asked', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const centroidBefore = recipe.context.worldCentroidUv(input);
      const scaled = new FaceUvOperationScale(1.5, 0.5, 'face-centroid').apply(input, recipe.context);
      const centroidAfter = recipe.context.worldCentroidUv(scaled);
      expect(centroidAfter.u).toBeCloseTo(centroidBefore.u, 9);
      expect(centroidAfter.v).toBeCloseTo(centroidBefore.v, 9);
      const before = input.decompose(recipe.faceNormal);
      const after = scaled.decompose(recipe.faceNormal);
      expect(Math.abs(after.scaleU)).toBeCloseTo(Math.abs(before.scaleU) * 1.5, 3);
      expect(Math.abs(after.scaleV)).toBeCloseTo(Math.abs(before.scaleV) * 0.5, 3);
    });
  });

  it('round-trips through the inverse factors and never mutates the input', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      const scaled = new FaceUvOperationScale(2, 4).apply(input, recipe.context);
      const restored = new FaceUvOperationScale(0.5, 0.25).apply(scaled, recipe.context);
      expect(restored.equals(input, 1e-9)).toBe(true);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
    });
  });

  it('leaves an axis unchanged for a zero or non-finite factor', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) {
      throw new Error('test factory produced no recipe');
    }
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    const zeroFactor = new FaceUvOperationScale(0, Number.NaN).apply(input, recipe.context);
    expect(zeroFactor.u.x).toBeCloseTo(input.u.x, 12);
    expect(zeroFactor.v.y).toBeCloseTo(input.v.y, 12);
  });
});
