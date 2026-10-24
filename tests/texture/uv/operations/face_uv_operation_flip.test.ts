import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationFlip } from '@/texture/uv/operations/face_uv_operation_flip.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationFlip', () => {
  it('negates the U row for a horizontal flip without a camera', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const flipped = new FaceUvOperationFlip('horizontal').apply(input, recipe.context);
      expect(rowDot(flipped, input, 'u', 'u')).toBeLessThan(0);
      expect(rowDot(flipped, input, 'v', 'v')).toBeGreaterThan(0);
    });
  });

  it('negates the V row for a vertical flip without a camera', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const flipped = new FaceUvOperationFlip('vertical').apply(input, recipe.context);
      expect(rowDot(flipped, input, 'v', 'v')).toBeLessThan(0);
      expect(rowDot(flipped, input, 'u', 'u')).toBeGreaterThan(0);
    });
  });

  it('keeps the face UV bounds center fixed while flipping', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const centerBefore = recipe.context.uvBoundsCenter(input);
      const flipped = new FaceUvOperationFlip('horizontal').apply(input, recipe.context);
      const centerAfter = recipe.context.uvBoundsCenter(flipped);
      expect(centerAfter.u).toBeCloseTo(centerBefore.u, 9);
      expect(centerAfter.v).toBeCloseTo(centerBefore.v, 9);
    });
  });

  it('flips twice back to the exact input matrix', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const flippedTwice = new FaceUvOperationFlip('horizontal').apply(
        new FaceUvOperationFlip('horizontal').apply(input, recipe.context),
        recipe.context,
      );
      expect(flippedTwice.equals(input, 1e-9)).toBe(true);
    });
  });

  it('swaps the flipped axis when the texture is seen sideways', () => {
    const faceNormal = new THREE.Vector3(0, 0, 1);
    const vertices = [
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(-1, 1, 0),
    ];
    const cameraRight = new THREE.Vector3(1, 0, 0);
    const context = new FaceUvOperationContext({ vertices, faceNormal, cameraRight });
    const sidewaysMatrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), faceNormal, 90, 2, 3);
    const flipped = new FaceUvOperationFlip('horizontal').apply(sidewaysMatrix, context);
    expect(rowDot(flipped, sidewaysMatrix, 'v', 'v')).toBeLessThan(0);
    expect(rowDot(flipped, sidewaysMatrix, 'u', 'u')).toBeGreaterThan(0);
  });
});

/**
 * Computes the direction dot product of one row between two matrices.
 *
 * @param a First matrix.
 * @param b Second matrix.
 * @param rowA Row of the first matrix.
 * @param rowB Row of the second matrix.
 * @returns Direction dot product (negative means mirrored).
 */
function rowDot(a: SurfaceUvMatrix, b: SurfaceUvMatrix, rowA: 'u' | 'v', rowB: 'u' | 'v'): number {
  const first = rowA === 'u' ? a.u : a.v;
  const second = rowB === 'u' ? b.u : b.v;
  return first.x * second.x + first.y * second.y + first.z * second.z;
}
