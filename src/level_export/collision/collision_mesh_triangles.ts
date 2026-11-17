import * as THREE from 'three';
import { CollisionNumberFormat } from '@/level_export/collision/collision_number_format.js';
import type { CollisionVector3 } from '@/level_export/collision/collision_types.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';

/** Vertices and triangles of a part given as a triangle mesh. */
export interface CollisionTriangleSoup {
  vertices: CollisionVector3[];
  triangles: [number, number, number][];
}

/**
 * Turns geometry that is not given as convex pieces into world-space vertex and
 * triangle lists.
 */
export class CollisionMeshTriangles {
  /**
   * Returns the triangles of a mesh in world space.
   *
   * @param mesh Mesh with a current world matrix.
   * @returns World vertices and index triples.
   */
  static ofMesh(mesh: THREE.Mesh): CollisionTriangleSoup {
    const position = mesh.geometry.getAttribute('position');
    const vertices: CollisionVector3[] = [];
    for (let index = 0; index < position.count; index++) {
      const world = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
      vertices.push(CollisionNumberFormat.vector3(world));
    }
    return { vertices, triangles: CollisionMeshTriangles.indexTriples(mesh.geometry, position.count) };
  }

  /**
   * Returns the faces of a brush as triangle fans.
   *
   * @param brush Brush in world space.
   * @returns Vertices and index triples.
   */
  static ofBrush(brush: SolidBrush): CollisionTriangleSoup {
    const vertices = brush.vertices.map((vertex) => CollisionNumberFormat.vector3(vertex));
    const triangles: [number, number, number][] = [];
    brush.faces.forEach((face) => {
      const corners: number[] = [];
      for (let edge = face.firstEdge; edge < face.firstEdge + face.edgeCount; edge++) {
        corners.push(brush.wingEdges[edge]?.vertexIndex ?? 0);
      }
      for (let index = 1; index + 1 < corners.length; index++) {
        triangles.push([corners[0] ?? 0, corners[index] ?? 0, corners[index + 1] ?? 0]);
      }
    });
    return { vertices, triangles };
  }

  /**
   * Returns the index triples of a geometry.
   *
   * @param geometry Indexed or non-indexed geometry.
   * @param vertexCount Number of vertices.
   * @returns Index triples.
   */
  private static indexTriples(geometry: THREE.BufferGeometry, vertexCount: number): [number, number, number][] {
    const index = geometry.getIndex();
    const count = index ? index.count : vertexCount;
    const triples: [number, number, number][] = [];
    for (let corner = 0; corner + 2 < count; corner += 3) {
      triples.push(
        index ? [index.getX(corner), index.getX(corner + 1), index.getX(corner + 2)] : [corner, corner + 1, corner + 2],
      );
    }
    return triples;
  }
}
