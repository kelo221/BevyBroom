import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationResetWorld } from '@/texture/uv/operations/face_uv_operation_reset_world.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationResetWorld', () => {
  it('rebuilds axis faces on their dominant world projection plane', () => {
    const axisCases: Array<{ faceNormal: THREE.Vector3; projectionNormal: THREE.Vector3 }> = [
      { faceNormal: new THREE.Vector3(0, 1, 0), projectionNormal: new THREE.Vector3(0, 1, 0) },
      { faceNormal: new THREE.Vector3(0, -1, 0), projectionNormal: new THREE.Vector3(0, -1, 0) },
      { faceNormal: new THREE.Vector3(1, 0, 0), projectionNormal: new THREE.Vector3(1, 0, 0) },
      { faceNormal: new THREE.Vector3(0, 0, -1), projectionNormal: new THREE.Vector3(0, 0, -1) },
      { faceNormal: new THREE.Vector3(-0.7, 0, 0.7).normalize(), projectionNormal: new THREE.Vector3(-1, 0, 0) },
      { faceNormal: new THREE.Vector3(1, 1, 1).normalize(), projectionNormal: new THREE.Vector3(0, 1, 0) },
      { faceNormal: new THREE.Vector3(0.3, -0.8, 0.52).normalize(), projectionNormal: new THREE.Vector3(0, -1, 0) },
    ];
    axisCases.forEach((axisCase) => {
      const reset = applyResetWorld(axisCase.faceNormal);
      const expected = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), axisCase.projectionNormal, 0, 1, 1);
      expect(reset.equals(expected, 1e-9)).toBe(true);
    });
  });

  it('produces unit scale, zero rotation, and zero offset from any input', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const reset = new FaceUvOperationResetWorld().apply(input, recipe.context);
      const trs = reset.decompose(dominantWorldAxis(recipe.faceNormal));
      expect(trs.scaleU).toBeCloseTo(1, 6);
      expect(trs.scaleV).toBeCloseTo(1, 6);
      expect(trs.rotationDeg).toBeCloseTo(0, 6);
      expect(trs.translation.x).toBeCloseTo(0, 6);
      expect(trs.translation.y).toBeCloseTo(0, 6);
      expect(SurfaceUvMatrix.fromSerialized(input.serialize()).equals(input, 1e-12)).toBe(true);
    });
  });
});

/**
 * Applies the world reset operation on a minimal face context.
 *
 * @param faceNormal Face normal of the reset face.
 * @returns Reset matrix.
 */
function applyResetWorld(faceNormal: THREE.Vector3): SurfaceUvMatrix {
  const context = new FaceUvOperationContext({
    vertices: [
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1),
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, 0, 1),
    ],
    faceNormal,
  });
  return new FaceUvOperationResetWorld().apply(SurfaceUvMatrix.identity(), context);
}

/**
 * Computes the dominant world axis of a face normal.
 *
 * @param faceNormal Unit face normal.
 * @returns Unit dominant world axis (signed).
 */
function dominantWorldAxis(faceNormal: THREE.Vector3): THREE.Vector3 {
  const absX = Math.abs(faceNormal.x);
  const absY = Math.abs(faceNormal.y);
  const absZ = Math.abs(faceNormal.z);
  if (absY >= absX && absY >= absZ) {
    return new THREE.Vector3(0, Math.sign(faceNormal.y), 0);
  }
  if (absX >= absZ) {
    return new THREE.Vector3(Math.sign(faceNormal.x), 0, 0);
  }
  return new THREE.Vector3(0, 0, Math.sign(faceNormal.z));
}
