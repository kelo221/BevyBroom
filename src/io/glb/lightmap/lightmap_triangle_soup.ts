import * as THREE from 'three';

/**
 * Triangles of one mesh in a form the lightmap chart builder reads: world space
 * vertex positions, the source vertex of every triangle corner, and one plane
 * per triangle.
 */
export interface LightmapTriangleSoup {
  /** World space position per source vertex, three numbers each. */
  readonly positions: Float32Array;
  /** Source vertex index per triangle corner, three per triangle. */
  readonly corners: Uint32Array;
  /**
   * Unit normal per triangle, three numbers each; zero for degenerate
   * triangles.
   */
  readonly normals: Float32Array;
  /** Plane offset (normal dot point) per triangle. */
  readonly planeOffsets: Float32Array;
  readonly triangleCount: number;
  readonly vertexCount: number;
}

/** Reads mesh geometry into a lightmap triangle soup. */
export class LightmapTriangleSoupReader {
  /**
   * Reads every triangle of a mesh, placing vertices with the mesh's world
   * matrix so chart sizes follow the size the mesh has in the level.
   *
   * @param geometry Mesh geometry with a position attribute.
   * @param worldMatrix Mesh world matrix.
   * @returns Triangle soup, or null when the geometry has no triangles.
   */
  static read(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4): LightmapTriangleSoup | null {
    const position = geometry.getAttribute('position');
    if (!position || position.count === 0) {
      return null;
    }
    const corners = LightmapTriangleSoupReader.cornersRead(geometry, position.count);
    const triangleCount = Math.floor(corners.length / 3);
    if (triangleCount === 0) {
      return null;
    }
    const positions = LightmapTriangleSoupReader.positionsRead(position, worldMatrix);
    const normals = new Float32Array(triangleCount * 3);
    const planeOffsets = new Float32Array(triangleCount);
    LightmapTriangleSoupReader.planesCompute(positions, corners, normals, planeOffsets);
    return { positions, corners, normals, planeOffsets, triangleCount, vertexCount: position.count };
  }

  /**
   * Returns the source vertex of every triangle corner.
   *
   * @param geometry Mesh geometry.
   * @param vertexCount Number of source vertices.
   * @returns Corner indices, a multiple of three long.
   */
  private static cornersRead(geometry: THREE.BufferGeometry, vertexCount: number): Uint32Array {
    const index = geometry.getIndex();
    const cornerCount = index ? index.count : vertexCount;
    const corners = new Uint32Array(cornerCount - (cornerCount % 3));
    for (let corner = 0; corner < corners.length; corner++) {
      corners[corner] = index ? index.getX(corner) : corner;
    }
    return corners;
  }

  /**
   * Returns world space vertex positions.
   *
   * @param position Position attribute.
   * @param worldMatrix Mesh world matrix.
   * @returns Three numbers per vertex.
   */
  private static positionsRead(
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    worldMatrix: THREE.Matrix4,
  ): Float32Array {
    const positions = new Float32Array(position.count * 3);
    const point = new THREE.Vector3();
    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex).applyMatrix4(worldMatrix);
      positions[vertex * 3] = point.x;
      positions[vertex * 3 + 1] = point.y;
      positions[vertex * 3 + 2] = point.z;
    }
    return positions;
  }

  /**
   * Computes the unit normal and plane offset of every triangle.
   *
   * @param positions World space vertex positions.
   * @param corners Source vertex per corner.
   * @param normals Output normals.
   * @param planeOffsets Output plane offsets.
   */
  private static planesCompute(
    positions: Float32Array,
    corners: Uint32Array,
    normals: Float32Array,
    planeOffsets: Float32Array,
  ): void {
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    const third = new THREE.Vector3();
    for (let triangle = 0; triangle < planeOffsets.length; triangle++) {
      LightmapTriangleSoupReader.pointRead(positions, corners[triangle * 3] ?? 0, first);
      LightmapTriangleSoupReader.pointRead(positions, corners[triangle * 3 + 1] ?? 0, second);
      LightmapTriangleSoupReader.pointRead(positions, corners[triangle * 3 + 2] ?? 0, third);
      const normal = second.sub(first).cross(third.sub(first)).normalize();
      normal.toArray(normals, triangle * 3);
      planeOffsets[triangle] = normal.dot(first);
    }
  }

  /**
   * Reads one vertex position.
   *
   * @param positions Packed positions.
   * @param vertex Vertex index.
   * @param target Receives the position.
   * @returns The target.
   */
  static pointRead(positions: Float32Array, vertex: number, target: THREE.Vector3): THREE.Vector3 {
    return target.fromArray(positions, vertex * 3);
  }
}
