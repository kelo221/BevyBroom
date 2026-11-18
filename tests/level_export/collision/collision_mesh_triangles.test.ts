import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionMeshTriangles } from '@/level_export/collision/collision_mesh_triangles.js';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';

/** Parts that are not convex are given as world-space triangles. */
describe('CollisionMeshTriangles', () => {
  it('gives a moved mesh its world vertices and its triangles', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.position.set(5, 0, 0);
    mesh.updateMatrixWorld(true);
    const soup = CollisionMeshTriangles.ofMesh(mesh);
    expect(soup.triangles).toHaveLength(12);
    expect(Math.min(...soup.vertices.map((vertex) => vertex[0]))).toBe(4);
    expect(soup.triangles.flat().every((index) => index < soup.vertices.length)).toBe(true);
  });

  it('gives a brush its faces as triangle fans', () => {
    const soup = CollisionMeshTriangles.ofBrush(
      SolidBrushFactory.createBox(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)),
    );
    expect(soup.vertices).toHaveLength(8);
    expect(soup.triangles).toHaveLength(12);
  });
});
