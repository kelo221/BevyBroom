import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationJustify } from '@/texture/uv/operations/face_uv_operation_justify.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationJustify', () => {
  it('lands the outermost corner of each side on a tile boundary', () => {
    const sides = ['left', 'right', 'top', 'bottom'] as const;
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      sides.forEach((side) => {
        const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
        const justified = new FaceUvOperationJustify(side).apply(input, recipe.context);
        const bounds = recipe.context.uvBounds(justified);
        const anchoredValue =
          side === 'left' ? bounds.minU : side === 'right' ? bounds.maxU : side === 'top' ? bounds.maxV : bounds.minV;
        expect(anchoredValue).toBeCloseTo(Math.round(anchoredValue), 6);
      });
    });
  });

  it('puts the UV center on a half-tile center for the center side', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const justified = new FaceUvOperationJustify('center').apply(input, recipe.context);
      const center = recipe.context.uvBoundsCenter(justified);
      expect(center.u - Math.floor(center.u)).toBeCloseTo(0.5, 6);
      expect(center.v - Math.floor(center.v)).toBeCloseTo(0.5, 6);
    });
  });

  it('changes offsets only, keeping directions and extents intact', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const inputBounds = recipe.context.uvBounds(input);
      const justified = new FaceUvOperationJustify('left').apply(input, recipe.context);
      const justifiedBounds = recipe.context.uvBounds(justified);
      const expectedShift = Math.floor(inputBounds.minU) - inputBounds.minU;
      expect(justified.u.x).toBeCloseTo(input.u.x, 12);
      expect(justified.u.y).toBeCloseTo(input.u.y, 12);
      expect(justified.u.z).toBeCloseTo(input.u.z, 12);
      expect(justified.v.x).toBeCloseTo(input.v.x, 12);
      expect(justified.u.w).toBeCloseTo(input.u.w + expectedShift, 9);
      expect(justifiedBounds.maxU - justifiedBounds.minU).toBeCloseTo(inputBounds.maxU - inputBounds.minU, 9);
    });
  });

  it('is idempotent and never mutates the input matrix', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const inputSnapshot = input.serialize();
      const once = new FaceUvOperationJustify('top').apply(input, recipe.context);
      const twice = new FaceUvOperationJustify('top').apply(once, recipe.context);
      expect(twice.equals(once, 1e-9)).toBe(true);
      expect(SurfaceUvMatrix.fromSerialized(inputSnapshot).equals(input, 1e-12)).toBe(true);
    });
  });
});
