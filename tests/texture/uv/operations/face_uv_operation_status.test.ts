import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationAlignEdge } from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import { FaceUvOperationFit } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { FaceUvOperationJustify } from '@/texture/uv/operations/face_uv_operation_justify.js';
import { FaceUvOperationStatus } from '@/texture/uv/operations/face_uv_operation_status.js';
import { shiftFaceUvRowOffset } from '@/texture/uv/operations/face_uv_operation_math.js';
import { createSeededFaceUvMatrix, createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationStatus', () => {
  it('reports fitted only along axes the fit operation covered', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const fitted = new FaceUvOperationFit({ axis: 'u' }).apply(input, recipe.context);
      expect(FaceUvOperationStatus.isFaceFitted(fitted, recipe.context, 'u')).toBe(true);
      expect(FaceUvOperationStatus.isFaceFitted(fitted, recipe.context, 'v')).toBe(false);
    });
  });

  it('reports unfitted for a clearly fractional extent', () => {
    const context = createAxisQuadContext(1, 1);
    const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.13, 0.29), new THREE.Vector3(0, 0, 1), 0, 0.9, 1.1);
    expect(FaceUvOperationStatus.isFaceFitted(matrix, context, 'u')).toBe(false);
    expect(FaceUvOperationStatus.isFaceFitted(matrix, context, 'v')).toBe(false);
  });

  it('honors the tolerance around the fitted state', () => {
    const context = createAxisQuadContext(1, 1);
    const fitted = new FaceUvOperationFit().apply(
      SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.13, 0.29), new THREE.Vector3(0, 0, 1), 0, 0.9, 1.1),
      context,
    );
    const withinTolerance = shiftFaceUvRowOffset(fitted, 'u', 0.0005);
    const beyondTolerance = shiftFaceUvRowOffset(fitted, 'u', 0.002);
    expect(FaceUvOperationStatus.isFaceFitted(withinTolerance, context, 'u')).toBe(true);
    expect(FaceUvOperationStatus.isFaceFitted(beyondTolerance, context, 'u')).toBe(false);
  });

  it('reports justified on the side the justify operation anchored', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const justified = new FaceUvOperationJustify('left').apply(input, recipe.context);
      expect(FaceUvOperationStatus.isFaceJustified(justified, recipe.context, 'left')).toBe(true);
      const centered = new FaceUvOperationJustify('center').apply(input, recipe.context);
      expect(FaceUvOperationStatus.isFaceJustified(centered, recipe.context, 'center')).toBe(true);
      expect(FaceUvOperationStatus.isFaceJustified(centered, recipe.context, 'left')).toBe(false);
    });
  });

  it('reports aligned once an edge sits on the U axis', () => {
    const recipes = createSeededQuadRecipes(8);
    recipes.forEach((recipe) => {
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      expect(FaceUvOperationStatus.isFaceAligned(input, recipe.context)).toBe(false);
      const aligned = new FaceUvOperationAlignEdge('best').apply(input, recipe.context);
      expect(FaceUvOperationStatus.isFaceAligned(aligned, recipe.context)).toBe(true);
    });
  });
});

/**
 * Builds a quad context in the XY plane.
 *
 * @param halfU Half extent along world X.
 * @param halfV Half extent along world Y.
 * @returns Quad context with a +Z face normal.
 */
function createAxisQuadContext(halfU: number, halfV: number): FaceUvOperationContext {
  return new FaceUvOperationContext({
    vertices: [
      new THREE.Vector3(-halfU, -halfV, 0),
      new THREE.Vector3(halfU, -halfV, 0),
      new THREE.Vector3(halfU, halfV, 0),
      new THREE.Vector3(-halfU, halfV, 0),
    ],
    faceNormal: new THREE.Vector3(0, 0, 1),
  });
}
