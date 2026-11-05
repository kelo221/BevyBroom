import { describe, expect, it } from 'vitest';
import {
  FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS,
  FaceUvOperationRandomShift,
} from '@/texture/uv/operations/face_uv_operation_random_shift.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import {
  createSeededFaceUvMatrix,
  createSeededQuadRecipes,
  FaceUvTestSeedRandom,
} from './face_uv_operation_test_face_factory.js';

/**
 * Rebuilds a face context with a texture size.
 *
 * @param context Face context without a texture size.
 * @param width Texture width in pixels.
 * @param height Texture height in pixels.
 * @returns Context carrying the texture size.
 */
function contextWithTextureSize(
  context: FaceUvOperationContext,
  width: number,
  height: number,
): FaceUvOperationContext {
  return new FaceUvOperationContext({
    vertices: context.vertices.map((vertex) => vertex.clone()),
    faceNormal: context.faceNormal,
    textureSizePixels: { width, height },
  });
}

describe('FaceUvOperationRandomShift', () => {
  it('shifts only the chosen axis offset by a whole texel count inside one tile', () => {
    const random = new FaceUvTestSeedRandom(5);
    createSeededQuadRecipes(10).forEach((recipe, index) => {
      const axis = index % 2 === 0 ? 'u' : 'v';
      const width = 32 * (1 + (index % 3));
      const height = 16 * (1 + (index % 4));
      const context = contextWithTextureSize(recipe.context, width, height);
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const shifted = new FaceUvOperationRandomShift(axis, () => random.nextUnit()).apply(input, context);
      const changedRow = axis === 'u' ? shifted.u : shifted.v;
      const changedInput = axis === 'u' ? input.u : input.v;
      const keptRow = axis === 'u' ? shifted.v : shifted.u;
      const keptInput = axis === 'u' ? input.v : input.u;
      const texels = (changedRow.w - changedInput.w) * (axis === 'u' ? width : height);
      expect(Math.abs(texels - Math.round(texels))).toBeLessThan(1e-6);
      expect(Math.round(texels)).toBeGreaterThanOrEqual(1);
      expect(Math.round(texels)).toBeLessThanOrEqual((axis === 'u' ? width : height) - 1);
      expect(changedRow.x).toBe(changedInput.x);
      expect(changedRow.y).toBe(changedInput.y);
      expect(changedRow.z).toBe(changedInput.z);
      expect(keptRow.equals(keptInput)).toBe(true);
    });
  });

  it('reproduces the same shift when it runs on the same face again', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) throw new Error('missing recipe');
    const random = new FaceUvTestSeedRandom(17);
    const operation = new FaceUvOperationRandomShift('u', () => random.nextUnit());
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    const first = operation.apply(input, recipe.context);
    const second = operation.apply(input, recipe.context);
    expect(second.u.w).toBe(first.u.w);
  });

  it('measures texels on the fallback tile size without a known texture size', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) throw new Error('missing recipe');
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    const largestDraw = 1 - Number.EPSILON;
    const shifted = new FaceUvOperationRandomShift('v', () => largestDraw).apply(input, recipe.context);
    const texels = (shifted.v.w - input.v.w) * FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS;
    expect(texels).toBeCloseTo(FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS - 1, 6);
  });
});
