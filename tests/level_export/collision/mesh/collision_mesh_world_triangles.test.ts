import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { materialIdentityWrite } from '@/materials/identity/material_identity.js';
import { CollisionMeshWorldTriangles } from '@/level_export/collision/mesh/collision_mesh_world_triangles.js';

/**
 * Creates a material stamped with a texture.
 *
 * @param texture Material identity.
 * @returns Material.
 */
function stampedMaterialCreate(texture: string): THREE.Material {
  const material = new THREE.MeshStandardMaterial();
  materialIdentityWrite(material, texture);
  return material;
}

/**
 * Content mesh triangles are read in world space with the texture of their draw
 * group.
 */
describe('CollisionMeshWorldTriangles', () => {
  it('reads every triangle in world space with the texture of its material slot', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = geometry.groups.map((_group, slot) => stampedMaterialCreate(`textures/side_${slot}.png`));
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(5, -1, 2);
    mesh.updateMatrixWorld(true);
    const triangles = CollisionMeshWorldTriangles.of(mesh);
    const indexCount = geometry.getIndex()?.count ?? 0;
    expect(triangles).toHaveLength(indexCount / 3);
    const bounds = new THREE.Box3().setFromObject(mesh);
    triangles.forEach((triangle) =>
      triangle.corners.forEach((corner) => expect(bounds.distanceToPoint(corner)).toBeLessThan(1e-6)),
    );
    geometry.groups.forEach((group, slot) => {
      const firstTriangle = triangles[group.start / 3];
      expect(firstTriangle?.texture).toBe(`textures/side_${slot}.png`);
    });
  });

  it('gives triangles of a material without identity an empty texture', () => {
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    expect(CollisionMeshWorldTriangles.of(mesh).every((triangle) => triangle.texture === '')).toBe(true);
  });
});
