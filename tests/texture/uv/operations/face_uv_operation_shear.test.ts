import { describe, expect, it } from 'vitest';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationShear } from '@/texture/uv/operations/face_uv_operation_shear.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationShear', () => {
  it('adds the shear factor times V to every vertex U coordinate', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const factor = 0.35;
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const sheared = new FaceUvOperationShear('u-by-v', factor).apply(input, recipe.context);
      const before = recipe.context.vertexUvs(input);
      const after = recipe.context.vertexUvs(sheared);
      after.forEach((uv, index) => {
        const previous = requireVertexUv(before, index);
        expect(uv.u).toBeCloseTo(previous.u + factor * previous.v, 9);
        expect(uv.v).toBeCloseTo(previous.v, 12);
      });
    });
  });

  it('adds the shear factor times U to every vertex V coordinate', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const factor = -0.6;
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const sheared = new FaceUvOperationShear('v-by-u', factor).apply(input, recipe.context);
      const before = recipe.context.vertexUvs(input);
      const after = recipe.context.vertexUvs(sheared);
      after.forEach((uv, index) => {
        const previous = requireVertexUv(before, index);
        expect(uv.v).toBeCloseTo(previous.v + factor * previous.u, 9);
        expect(uv.u).toBeCloseTo(previous.u, 12);
      });
    });
  });

  it('inverts exactly with the opposite factor and never mutates the input', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const factor = 0.8;
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      const sheared = new FaceUvOperationShear('u-by-v', factor).apply(input, recipe.context);
      const restored = new FaceUvOperationShear('u-by-v', -factor).apply(sheared, recipe.context);
      expect(restored.equals(input, 1e-9)).toBe(true);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
    });
  });

  it('keeps the plane normal and row magnitudes unchanged', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const sheared = new FaceUvOperationShear('u-by-v', 0.5).apply(input, recipe.context);
      expect(
        sheared.planeNormalAlignedTo(recipe.faceNormal).distanceTo(input.planeNormalAlignedTo(recipe.faceNormal)),
      ).toBeLessThan(1e-9);
      expect(Math.hypot(sheared.v.x, sheared.v.y, sheared.v.z)).toBeCloseTo(
        Math.hypot(input.v.x, input.v.y, input.v.z),
        9,
      );
    });
  });
});

/**
 * Reads one vertex UV pair, failing the test when the index is out of range.
 *
 * @param uvs Vertex UV pairs.
 * @param index Vertex index.
 * @returns The UV pair at the index.
 */
function requireVertexUv(uvs: { u: number; v: number }[], index: number): { u: number; v: number } {
  const entry = uvs[index];
  if (!entry) {
    throw new Error(`vertex UV missing at index ${index}`);
  }
  return entry;
}
