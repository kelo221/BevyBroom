import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';

/** Vertex buffers of a geometry being built. */
interface ProceduralGeometryBuffers {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
}

/** UV tiles per meter, the same as a brush face with a unit texture scale. */
const PROCEDURAL_GEOMETRY_UV_SCALE = 1;

/**
 * Turns convex parts into a flat-shaded triangle geometry. Every part becomes
 * one draw group whose material index is the part's index, and every face gets
 * planar UVs in the owner's space at a fixed scale, so textures keep their size
 * however far the parts are stretched.
 */
export class ProceduralGeometryBuilder {
  /**
   * Builds the geometry of a list of parts.
   *
   * @param parts Convex parts in owner space.
   * @returns Non-indexed geometry with positions, normals, UVs and one group
   *   per part.
   */
  static create(parts: readonly ProceduralPart[]): THREE.BufferGeometry {
    const buffers: ProceduralGeometryBuffers = { positions: [], normals: [], uvs: [] };
    const geometry = new THREE.BufferGeometry();
    parts.forEach((part, partIndex) => {
      const firstVertex = buffers.positions.length / 3;
      part.faces.forEach((face) => ProceduralGeometryBuilder.faceAppend(buffers, face));
      geometry.addGroup(firstVertex, buffers.positions.length / 3 - firstVertex, partIndex);
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Returns the outward unit normal of a convex face wound counter-clockwise.
   *
   * @param face Face corners.
   * @returns Unit normal, or a zero vector for a degenerate face.
   */
  static faceNormal(face: readonly THREE.Vector3[]): THREE.Vector3 {
    const normal = new THREE.Vector3();
    face.forEach((current, index) => {
      const next = face[(index + 1) % face.length] ?? current;
      normal.x += (current.y - next.y) * (current.z + next.z);
      normal.y += (current.z - next.z) * (current.x + next.x);
      normal.z += (current.x - next.x) * (current.y + next.y);
    });
    return normal.lengthSq() > 0 ? normal.normalize() : normal;
  }

  /**
   * Appends one face as a triangle fan with its normal and UVs. Degenerate
   * faces add nothing.
   *
   * @param buffers Buffers being filled.
   * @param face Face corners.
   */
  private static faceAppend(buffers: ProceduralGeometryBuffers, face: readonly THREE.Vector3[]): void {
    const normal = ProceduralGeometryBuilder.faceNormal(face);
    if (face.length < 3 || normal.lengthSq() === 0) {
      return;
    }
    const uvMatrix = SurfaceUvMatrix.fromTrs(
      new THREE.Vector2(0, 0),
      normal,
      0,
      PROCEDURAL_GEOMETRY_UV_SCALE,
      PROCEDURAL_GEOMETRY_UV_SCALE,
    );
    for (const corner of ProceduralGeometryBuilder.fanCornersOf(face)) {
      ProceduralGeometryBuilder.vertexAppend(buffers, corner, normal, uvMatrix);
    }
  }

  /**
   * Returns the corners of a convex face's triangle fan, three per triangle.
   *
   * @param face Face corners, at least three.
   * @returns Triangle corners in draw order.
   */
  private static fanCornersOf(face: readonly THREE.Vector3[]): THREE.Vector3[] {
    const [first, ...rest] = face;
    const corners: THREE.Vector3[] = [];
    if (first === undefined) {
      return corners;
    }
    for (let index = 0; index + 1 < rest.length; index++) {
      corners.push(first, rest[index] ?? first, rest[index + 1] ?? first);
    }
    return corners;
  }

  /**
   * Appends one vertex.
   *
   * @param buffers Buffers being filled.
   * @param corner Vertex position.
   * @param normal Face normal.
   * @param uvMatrix Planar projection of the face.
   */
  private static vertexAppend(
    buffers: ProceduralGeometryBuffers,
    corner: THREE.Vector3,
    normal: THREE.Vector3,
    uvMatrix: SurfaceUvMatrix,
  ): void {
    const uv = uvMatrix.project(corner);
    buffers.positions.push(corner.x, corner.y, corner.z);
    buffers.normals.push(normal.x, normal.y, normal.z);
    buffers.uvs.push(uv.u, uv.v);
  }
}
