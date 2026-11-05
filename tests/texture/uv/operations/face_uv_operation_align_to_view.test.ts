import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FaceUvOperationAlignToView,
  alignToViewProjectOntoPlane,
} from '@/texture/uv/operations/face_uv_operation_align_to_view.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { faceUvRowMagnitude } from '@/texture/uv/operations/face_uv_operation_math.js';
import {
  createSeededFaceUvMatrix,
  createSeededQuadRecipes,
  FaceUvTestSeedRandom,
} from './face_uv_operation_test_face_factory.js';

/**
 * Builds a camera basis looking at the origin from a seeded direction.
 *
 * @param random Seeded random source.
 * @returns Camera right and up unit directions.
 */
function seededCameraBasis(random: FaceUvTestSeedRandom): { right: THREE.Vector3; up: THREE.Vector3 } {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(random.nextInRange(-5, 5), random.nextInRange(1, 5), random.nextInRange(-5, 5));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  return { right, up };
}

/**
 * Rebuilds a face context with camera directions.
 *
 * @param context Face context without a camera.
 * @param camera Camera right and up.
 * @returns Context carrying the camera.
 */
function contextWithCamera(
  context: FaceUvOperationContext,
  camera: { right: THREE.Vector3; up: THREE.Vector3 },
): FaceUvOperationContext {
  return new FaceUvOperationContext({
    vertices: context.vertices.map((vertex) => vertex.clone()),
    faceNormal: context.faceNormal,
    cameraRight: camera.right,
    cameraUp: camera.up,
  });
}

describe('FaceUvOperationAlignToView', () => {
  it('aligns U and V with camera right and up projected onto the face at the face scale', () => {
    const random = new FaceUvTestSeedRandom(77);
    createSeededQuadRecipes(12).forEach((recipe) => {
      const camera = seededCameraBasis(random);
      const context = contextWithCamera(recipe.context, camera);
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const aligned = new FaceUvOperationAlignToView().apply(input, context);
      const expectedU = alignToViewProjectOntoPlane(camera.right, context.faceNormal).multiplyScalar(
        faceUvRowMagnitude(input.u),
      );
      const expectedV = alignToViewProjectOntoPlane(camera.up, context.faceNormal).multiplyScalar(
        faceUvRowMagnitude(input.v),
      );
      expect(new THREE.Vector3(aligned.u.x, aligned.u.y, aligned.u.z).distanceTo(expectedU)).toBeLessThan(1e-9);
      expect(new THREE.Vector3(aligned.v.x, aligned.v.y, aligned.v.z).distanceTo(expectedV)).toBeLessThan(1e-9);
    });
  });

  it('matches the slide projector on the face so faces aligned from one view continue the image', () => {
    const random = new FaceUvTestSeedRandom(91);
    createSeededQuadRecipes(8).forEach((recipe) => {
      const camera = seededCameraBasis(random);
      const context = contextWithCamera(recipe.context, camera);
      const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
      const aligned = new FaceUvOperationAlignToView().apply(input, context);
      context.vertices.forEach((vertex) => {
        const projected = aligned.project(vertex);
        expect(projected.u).toBeCloseTo(camera.right.dot(vertex) * faceUvRowMagnitude(input.u), 9);
        expect(projected.v).toBeCloseTo(camera.up.dot(vertex) * faceUvRowMagnitude(input.v), 9);
      });
    });
  });

  it('leaves the matrix alone without a camera', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) throw new Error('missing recipe');
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    expect(new FaceUvOperationAlignToView().apply(input, recipe.context)).toBe(input);
  });

  it('completes the frame from the other axis when one camera axis looks along the face normal', () => {
    const recipe = createSeededQuadRecipes(1)[0];
    if (!recipe) throw new Error('missing recipe');
    const normal = recipe.faceNormal.clone().normalize();
    const inPlane = alignToViewProjectOntoPlane(new THREE.Vector3(0.3, 0.6, 0.74), normal).normalize();
    const context = contextWithCamera(recipe.context, { right: inPlane, up: normal });
    const input = createSeededFaceUvMatrix(recipe.seed, recipe.faceNormal);
    const aligned = new FaceUvOperationAlignToView().apply(input, context);
    const vDirection = new THREE.Vector3(aligned.v.x, aligned.v.y, aligned.v.z);
    expect(Math.abs(vDirection.dot(normal))).toBeLessThan(1e-9);
    expect(Math.abs(vDirection.dot(inPlane))).toBeLessThan(1e-9);
    expect(vDirection.length()).toBeCloseTo(faceUvRowMagnitude(input.v), 9);
  });
});
