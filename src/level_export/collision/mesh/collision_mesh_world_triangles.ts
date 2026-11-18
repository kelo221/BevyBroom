import * as THREE from 'three';
import { exportContentMaterialResolve } from '@/io/scene/export_content_material_resolve.js';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';

/** One triangle of a mesh in world space with the texture drawn on it. */
export interface CollisionMeshWorldTriangle {
  readonly corners: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** Material identity of the triangle, empty when its material has none. */
  readonly texture: string;
}

/** One draw range of a geometry and the material slot it uses. */
interface CollisionMeshDrawRange {
  readonly start: number;
  readonly count: number;
  readonly materialIndex: number;
}

/** Reads the triangles of a content mesh in world space with their textures. */
export class CollisionMeshWorldTriangles {
  /**
   * Returns every triangle of a mesh in world space.
   *
   * @param mesh Mesh with a current world matrix.
   * @returns Triangles in draw order.
   */
  static of(mesh: THREE.Mesh): CollisionMeshWorldTriangle[] {
    const materials = CollisionMeshWorldTriangles.materialListOf(mesh);
    const triangles: CollisionMeshWorldTriangle[] = [];
    for (const range of CollisionMeshWorldTriangles.drawRangesOf(mesh.geometry)) {
      const texture = CollisionMeshWorldTriangles.textureOf(materials[range.materialIndex]);
      for (let corner = range.start; corner + 2 < range.start + range.count; corner += 3) {
        triangles.push({ corners: CollisionMeshWorldTriangles.cornersRead(mesh, corner), texture });
      }
    }
    return triangles;
  }

  /**
   * Returns the materials a mesh shows, as a list by material slot.
   *
   * @param mesh Content mesh.
   * @returns Materials by slot.
   */
  private static materialListOf(mesh: THREE.Mesh): THREE.Material[] {
    const materials = exportContentMaterialResolve(mesh);
    return Array.isArray(materials) ? materials : [materials];
  }

  /**
   * Returns the draw groups of a geometry, or one range over all of it when it
   * has none.
   *
   * @param geometry Indexed or non-indexed geometry.
   * @returns Draw ranges with their material slot.
   */
  private static drawRangesOf(geometry: THREE.BufferGeometry): CollisionMeshDrawRange[] {
    if (geometry.groups.length > 0) {
      return geometry.groups.map((group) => ({
        start: group.start,
        count: group.count,
        materialIndex: group.materialIndex ?? 0,
      }));
    }
    const count = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
    return [{ start: 0, count, materialIndex: 0 }];
  }

  /**
   * Returns the texture of a material.
   *
   * @param material Material of a draw range, if the slot has one.
   * @returns Its material identity, or empty.
   */
  private static textureOf(material: THREE.Material | undefined): string {
    return material ? (materialIdentityRead(material) ?? '') : '';
  }

  /**
   * Reads the three world corners of the triangle starting at a draw corner.
   *
   * @param mesh Mesh with a current world matrix.
   * @param firstCorner Draw corner of the triangle's first corner.
   * @returns World corners.
   */
  private static cornersRead(
    mesh: THREE.Mesh,
    firstCorner: number,
  ): readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    return [
      CollisionMeshWorldTriangles.cornerRead(mesh, firstCorner),
      CollisionMeshWorldTriangles.cornerRead(mesh, firstCorner + 1),
      CollisionMeshWorldTriangles.cornerRead(mesh, firstCorner + 2),
    ];
  }

  /**
   * Reads one world corner of a mesh.
   *
   * @param mesh Mesh with a current world matrix.
   * @param drawCorner Draw corner, resolved through the index when there is
   *   one.
   * @returns World position.
   */
  private static cornerRead(mesh: THREE.Mesh, drawCorner: number): THREE.Vector3 {
    const vertexIndex = mesh.geometry.getIndex()?.getX(drawCorner) ?? drawCorner;
    const position = mesh.geometry.getAttribute('position');
    return new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
  }
}
