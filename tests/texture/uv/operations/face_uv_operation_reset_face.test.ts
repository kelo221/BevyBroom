import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationResetFace } from '@/texture/uv/operations/face_uv_operation_reset_face.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationResetFace', () => {
  it('rebuilds the matrix on the face plane with unit scale and zero offset', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const reset = new FaceUvOperationResetFace().apply(input, recipe.context);
      const expected = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), recipe.faceNormal, 0, 1, 1);
      expect(reset.equals(expected, 1e-9)).toBe(true);
    });
  });

  it('decomposes to identity TRS against the face normal and keeps the input intact', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const snapshot = input.serialize();
      const reset = new FaceUvOperationResetFace().apply(input, recipe.context);
      const trs = reset.decompose(recipe.faceNormal);
      expect(trs.scaleU).toBeCloseTo(1, 6);
      expect(trs.scaleV).toBeCloseTo(1, 6);
      expect(trs.rotationDeg).toBeCloseTo(0, 6);
      expect(trs.translation.x).toBeCloseTo(0, 6);
      expect(trs.translation.y).toBeCloseTo(0, 6);
      expect(SurfaceUvMatrix.fromSerialized(snapshot).equals(input, 1e-12)).toBe(true);
    });
  });
});
