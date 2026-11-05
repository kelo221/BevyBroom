import * as THREE from 'three';
import type { FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';
import { SolidBrushMeshChunkBuilder } from '@/solid/mesh/solid_brush_mesh_chunk.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import type { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import { DisplacementMeshNormals } from './displacement_mesh_normals.js';

/**
 * Builds the indexed triangle geometry of one displacement surface: displaced
 * positions, smooth normals and UVs projected from the flat face through the
 * face's UV matrix, exactly as the face's own triangles are textured.
 */
export class DisplacementMeshBuilder {
  /**
   * Builds the geometry of a placed displacement.
   *
   * @param placement Flat grid placed in the geometry's space.
   * @param displacement Offsets, elevation and scale.
   * @param surface Texture and UV matrix of the face.
   * @returns New indexed geometry with position, normal and uv attributes.
   */
  static build(
    placement: DisplacementSurfacePlacement,
    displacement: Readonly<DisplacementFaceSurface>,
    surface: FaceSurfaceDescription,
  ): THREE.BufferGeometry {
    const positions = placement.displacedPositions(displacement);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(DisplacementMeshBuilder.flatten(positions), 3));
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(DisplacementMeshNormals.compute(positions, placement.rowLength, placement.normal), 3),
    );
    geometry.setAttribute('uv', new THREE.BufferAttribute(DisplacementMeshBuilder.uvsBuild(placement, surface), 2));
    geometry.setIndex(DisplacementMeshBuilder.indicesBuild(placement.rowLength));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Builds the triangle index list of a row-major grid. Each cell becomes two
   * triangles that keep the face corners' winding.
   *
   * @param rowLength Vertices per grid side.
   * @returns Index list, three entries per triangle.
   */
  static indicesBuild(rowLength: number): number[] {
    const indices: number[] = [];
    for (let row = 0; row < rowLength - 1; row++) {
      for (let column = 0; column < rowLength - 1; column++) {
        const first = row * rowLength + column;
        const nextRow = first + rowLength;
        indices.push(first, first + 1, nextRow + 1, first, nextRow + 1, nextRow);
      }
    }
    return indices;
  }

  /**
   * Projects every flat brush-local grid position through the face UV matrix.
   *
   * @param placement Placed grid.
   * @param surface Texture and UV matrix of the face.
   * @returns UV buffer with two floats per vertex.
   */
  private static uvsBuild(placement: DisplacementSurfacePlacement, surface: FaceSurfaceDescription): Float32Array {
    const uvs = new Float32Array(placement.baseLocalPositions.length * 2);
    placement.baseLocalPositions.forEach((point, vertexIndex) => {
      SolidBrushMeshChunkBuilder.uvWriteFromBrushLocalPoint(point, surface, uvs, vertexIndex);
    });
    return uvs;
  }

  /**
   * Flattens positions into an XYZ float list.
   *
   * @param positions Position list.
   * @returns Float list with three entries per position.
   */
  private static flatten(positions: readonly THREE.Vector3[]): number[] {
    const values: number[] = [];
    for (const position of positions) {
      values.push(position.x, position.y, position.z);
    }
    return values;
  }
}
