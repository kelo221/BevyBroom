import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationOffsetNudge } from '@/texture/uv/operations/face_uv_operation_offset_nudge.js';
import { createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationOffsetNudge', () => {
  it('moves the texture one step toward each screen direction', () => {
    const context = createAxisQuadContext(1, 1);
    const directions = ['right', 'left', 'up', 'down'] as const;
    directions.forEach((direction) => {
      const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), new THREE.Vector3(0, 0, 1), 0, 2, 3);
      const nudged = new FaceUvOperationOffsetNudge(direction, 0.25).apply(matrix, context);
      const screenProjection = measureVisibleScreenMovement(matrix, nudged, context, direction);
      const expectedSign = direction === 'right' || direction === 'up' ? 1 : -1;
      expect(screenProjection).toBeCloseTo(expectedSign * 0.25, 6);
    });
  });

  it('moves mirrored-scale textures in the same visible direction', () => {
    const context = createAxisQuadContext(1, 1);
    const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), new THREE.Vector3(0, 0, 1), 0, -2, 3);
    const nudged = new FaceUvOperationOffsetNudge('right', 0.25).apply(matrix, context);
    expect(measureVisibleScreenMovement(matrix, nudged, context, 'right')).toBeCloseTo(0.25, 6);
  });

  it('leaves the matrix unchanged without camera directions or with a zero step', () => {
    const recipes = createSeededQuadRecipes(2);
    recipes.forEach((recipe) => {
      const input = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), recipe.faceNormal, 0, 1, 1);
      const withoutCamera = new FaceUvOperationOffsetNudge('right', 0.25).apply(input, recipe.context);
      expect(withoutCamera.equals(input, 1e-12)).toBe(true);
    });
    const context = createAxisQuadContext(1, 1);
    const input = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), new THREE.Vector3(0, 0, 1), 0, 1, 1);
    const zeroStep = new FaceUvOperationOffsetNudge('right', 0).apply(input, context);
    expect(zeroStep.equals(input, 1e-12)).toBe(true);
  });

  it('does nothing when the axes tie on both camera directions', () => {
    const context = createAxisQuadContext(1, 1);
    const diagonalMatrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), new THREE.Vector3(0, 0, 1), 45, 1, 1);
    const nudged = new FaceUvOperationOffsetNudge('right', 0.25).apply(diagonalMatrix, context);
    expect(nudged.equals(diagonalMatrix, 1e-12)).toBe(true);
  });
});

/**
 * Builds a quad context in the XY plane with axis-aligned camera directions.
 *
 * @param halfU Half extent along world X.
 * @param halfV Half extent along world Y.
 * @returns Context with camera right +X and camera up +Y.
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
    cameraRight: new THREE.Vector3(1, 0, 0),
    cameraUp: new THREE.Vector3(0, 1, 0),
  });
}

/**
 * Measures how far the texture pattern visibly moved along a screen axis. The
 * texture feature originally under the first vertex is tracked: the world
 * displacement that restores its pre-nudge UV coordinates is the pattern's
 * visible movement.
 *
 * @param before Matrix before the nudge.
 * @param after Matrix after the nudge.
 * @param context Face context used for the nudge.
 * @param direction Screen axis projected onto: right/left use camera right,
 *   up/down use camera up.
 * @returns Signed world meters moved along the screen axis.
 */
function measureVisibleScreenMovement(
  before: SurfaceUvMatrix,
  after: SurfaceUvMatrix,
  context: FaceUvOperationContext,
  direction: 'right' | 'left' | 'up' | 'down',
): number {
  const anchor = context.vertexWorldAt(0);
  if (!anchor) {
    throw new Error('quad context has no vertices');
  }
  const beforeUv = before.project(anchor);
  const afterUv = after.project(anchor);
  const movement = worldDisplacementForUvDelta(before, afterUv.u - beforeUv.u, afterUv.v - beforeUv.v);
  const screenAxis = direction === 'right' || direction === 'left' ? context.cameraRight : context.cameraUp;
  if (!screenAxis) {
    throw new Error('camera direction missing');
  }
  return movement.dot(screenAxis.clone().normalize());
}

/**
 * Solves the world displacement that changes a matrix's UV output by a given
 * delta, using the matrix rows as the (orthogonal) plane basis.
 *
 * @param matrix Matrix whose rows map world positions to UV.
 * @param deltaU Required change in U.
 * @param deltaV Required change in V.
 * @returns World displacement producing the UV delta.
 */
function worldDisplacementForUvDelta(matrix: SurfaceUvMatrix, deltaU: number, deltaV: number): THREE.Vector3 {
  const uRow = new THREE.Vector3(matrix.u.x, matrix.u.y, matrix.u.z);
  const vRow = new THREE.Vector3(matrix.v.x, matrix.v.y, matrix.v.z);
  return uRow
    .clone()
    .multiplyScalar(-deltaU / uRow.lengthSq())
    .add(vRow.clone().multiplyScalar(-deltaV / vRow.lengthSq()));
}
