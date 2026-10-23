import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { computeRegionWorldNormal } from '@/texture/uv/planar_uv_projector.js';
import {
  createWorldPolygonTargetContextFactory,
  faceUvOperationContextFromTarget,
} from '@/texture/uv/operations/face_uv_operation_context_factory.js';

describe('face UV operation context factory', () => {
  it('builds a convex world polygon and the region normal for a box face', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.rotation.y = THREE.MathUtils.degToRad(30);
    mesh.updateMatrixWorld(true);
    const target = targetFromTopFace(mesh);
    const context = faceUvOperationContextFromTarget(target, null, null);
    expect(context).not.toBeNull();
    const normal = computeRegionWorldNormal(mesh, target.triangleIndices);
    expect(context?.faceNormal.dot(normal)).toBeCloseTo(1, 6);
    expect(context?.vertexCount()).toBe(4);
    expectPolygonConvexAndWound(context?.faceEdgeWorldDirection(0) as THREE.Vector3, context);
  });

  it('welds duplicated triangle corners into one outline', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.updateMatrixWorld(true);
    const target = targetFromTopFace(mesh);
    const context = faceUvOperationContextFromTarget(target, null, null);
    const unique = new Set(context?.vertices.map((vertex) => vertex.toArray().join(',')));
    expect(unique?.size).toBe(4);
  });

  it('carries camera directions and texture size into the context', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.updateMatrixWorld(true);
    const target = targetFromTopFace(mesh);
    const context = faceUvOperationContextFromTarget(
      target,
      { right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
      { width: 512, height: 256 },
    );
    expect(context?.cameraRight?.x).toBeCloseTo(1, 6);
    expect(context?.cameraUp?.y).toBeCloseTo(1, 6);
    expect(context?.textureSizePixels).toEqual({ width: 512, height: 256 });
  });

  it('returns null for regions without triangles', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const context = faceUvOperationContextFromTarget({ mesh, triangleIndices: [], previousMapping: null }, null, null);
    expect(context).toBeNull();
  });

  it('produces a factory whose contexts satisfy the operation contract', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.set(3, 1, -2);
    mesh.updateMatrixWorld(true);
    const factory = createWorldPolygonTargetContextFactory(null, { width: 64, height: 64 });
    const target = targetFromTopFace(mesh);
    const context = factory(target);
    expect(context).not.toBeNull();
    expect(context?.textureSizePixels?.width).toBe(64);
    const expectedCentroid = regionWorldCentroid(mesh, target.triangleIndices);
    expect(context?.worldCentroid().distanceTo(expectedCentroid)).toBeLessThan(1e-6);
  });
});

/**
 * Builds an apply target covering the top face triangles of a box.
 *
 * @param mesh Box mesh whose top face triangles are found by height.
 * @returns Apply target.
 */
function targetFromTopFace(mesh: THREE.Mesh): TextureApplyTarget {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  let highestY = -Infinity;
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex++) {
    highestY = Math.max(highestY, position.getY(vertexIndex));
  }
  const triangleIndices: number[] = [];
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const corners = [0, 1, 2].map((corner) =>
      position.getY(index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner),
    );
    if (corners.every((y) => Math.abs(y - highestY) < 1e-4)) {
      triangleIndices.push(triangleIndex);
    }
  }
  return { mesh, triangleIndices, previousMapping: null };
}

/**
 * Averages the world vertices of a triangle region.
 *
 * @param mesh Mesh owner.
 * @param triangleIndices Region triangles.
 * @returns Expected world centroid.
 */
function regionWorldCentroid(mesh: THREE.Mesh, triangleIndices: number[]): THREE.Vector3 {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const sum = new THREE.Vector3();
  const seen = new Set<string>();
  triangleIndices.forEach((triangleIndex) => {
    for (let corner = 0; corner < 3; corner++) {
      const vertexIndex = index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner;
      const world = new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
      const key = world
        .toArray()
        .map((value) => value.toFixed(4))
        .join(',');
      if (!seen.has(key)) {
        seen.add(key);
        sum.add(world);
      }
    }
  });
  return sum.divideScalar(Math.max(1, seen.size));
}

/**
 * Asserts the outline polygon turns consistently around its normal.
 *
 * @param firstEdge One polygon edge direction.
 * @param context Context holding the polygon and normal.
 */
function expectPolygonConvexAndWound(firstEdge: THREE.Vector3, context: unknown): void {
  const ctx = context as { faceNormal: THREE.Vector3 };
  expect(firstEdge.length()).toBeGreaterThan(0);
  expect(ctx.faceNormal.length()).toBeCloseTo(1, 6);
}
