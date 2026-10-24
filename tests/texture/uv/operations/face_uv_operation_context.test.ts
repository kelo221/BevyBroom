import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { createSeededQuadRecipes } from './face_uv_operation_test_face_factory.js';

describe('FaceUvOperationContext', () => {
  it('projects every vertex exactly as the matrix does', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.3, -0.7), recipe.faceNormal, 25, 1.7, -0.9);
      const projected = recipe.context.vertexUvs(matrix);
      expect(projected.length).toBe(recipe.context.vertexCount());
      projected.forEach((uv, index) => {
        const vertex = recipe.context.vertexWorldAt(index);
        expect(vertex).toBeDefined();
        const reference = matrix.project(vertex as THREE.Vector3);
        expect(uv.u).toBeCloseTo(reference.u, 12);
        expect(uv.v).toBeCloseTo(reference.v, 12);
      });
    });
  });

  it('bounds every projected vertex and centers the bounds', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(1.1, 0.4), recipe.faceNormal, -40, 2, 0.5);
      const bounds = recipe.context.uvBounds(matrix);
      const center = recipe.context.uvBoundsCenter(matrix);
      recipe.context.vertexUvs(matrix).forEach((uv) => {
        expect(uv.u).toBeGreaterThanOrEqual(bounds.minU - 1e-12);
        expect(uv.u).toBeLessThanOrEqual(bounds.maxU + 1e-12);
        expect(uv.v).toBeGreaterThanOrEqual(bounds.minV - 1e-12);
        expect(uv.v).toBeLessThanOrEqual(bounds.maxV + 1e-12);
      });
      expect(center.u).toBeCloseTo((bounds.minU + bounds.maxU) / 2, 12);
      expect(center.v).toBeCloseTo((bounds.minV + bounds.maxV) / 2, 12);
    });
  });

  it('computes the world centroid as the vertex average', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const centroid = recipe.context.worldCentroid();
      const expected = new THREE.Vector3();
      recipe.context.vertices.forEach((vertex) => expected.add(vertex));
      expected.divideScalar(recipe.context.vertexCount());
      expect(centroid.distanceTo(expected)).toBeLessThan(1e-12);
    });
  });

  it('provides winding-order edge directions in world and UV space', () => {
    const recipes = createSeededQuadRecipes(6);
    recipes.forEach((recipe) => {
      const matrix = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0, 0), recipe.faceNormal, 10, 1, 1);
      const edgeCount = recipe.context.faceEdgeCount();
      expect(edgeCount).toBe(recipe.context.vertexCount());
      for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
        const direction = recipe.context.faceEdgeWorldDirection(edgeIndex);
        const from = recipe.context.vertexWorldAt(edgeIndex) as THREE.Vector3;
        const to = recipe.context.vertexWorldAt((edgeIndex + 1) % edgeCount) as THREE.Vector3;
        const expected = to.clone().sub(from);
        expect(direction).toBeDefined();
        expect(direction?.distanceTo(expected)).toBeLessThan(1e-12);
      }
      const uvDirections = recipe.context.faceEdgeUvDirections(matrix);
      expect(uvDirections.length).toBe(edgeCount);
    });
  });

  it('keeps texture size and camera directions as independent copies', () => {
    const textureSize = { width: 512, height: 256 };
    const cameraRight = new THREE.Vector3(1, 0, 0);
    const cameraUp = new THREE.Vector3(0, 1, 0);
    const vertices = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 1, 0)];
    const context = new FaceUvOperationContext({
      vertices,
      faceNormal: new THREE.Vector3(0, 0, 1),
      textureSizePixels: textureSize,
      cameraRight,
      cameraUp,
    });
    textureSize.width = 64;
    cameraRight.set(0, 0, 1);
    expect(context.textureSizePixels?.width).toBe(512);
    expect(context.cameraRight?.x).toBe(1);
    expect(context.cameraUp?.y).toBe(1);
    vertices[0]?.set(9, 9, 9);
    expect(context.vertexWorldAt(0)?.x).toBe(0);
  });

  it('returns zero bounds and no edges for an empty polygon', () => {
    const context = new FaceUvOperationContext({
      vertices: [],
      faceNormal: new THREE.Vector3(0, 1, 0),
    });
    const bounds = context.uvBounds(SurfaceUvMatrix.identity());
    expect(bounds).toEqual({ minU: 0, maxU: 0, minV: 0, maxV: 0 });
    expect(context.faceEdgeWorldDirection(0)).toBeNull();
  });
});
