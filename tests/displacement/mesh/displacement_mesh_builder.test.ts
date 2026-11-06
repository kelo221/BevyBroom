import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount, getTriangleVertexIndices } from '@/selection/pick/utils_triangle_geometry.js';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import {
  displacementRowLength,
  displacementSurfaceCreate,
  displacementVertexCount,
} from '@/displacement/model/displacement_face_surface.js';
import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import { DisplacementMeshBuilder } from '@/displacement/mesh/displacement_mesh_builder.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/**
 * Builds an off-center box with unequal edges.
 *
 * @returns Rig, brush and the face pointing most along +X.
 */
function meshTestBrushCreate(): { rig: DisplacementTestRig; brush: SolidBrushInstance; surfaceIndex: number } {
  const rig = displacementTestRigCreate('MeshBuilder');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 3, 5), new THREE.Vector3(-2, 1, 3));
  return { rig, brush, surfaceIndex: displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0)) };
}

/**
 * Collects the UV of every result vertex of one brush face keyed by position.
 *
 * @param resultMesh Solid result mesh before the face was displaced.
 * @param brushId Brush id.
 * @param surfaceIndex Face index.
 * @returns Pairs of model-space position and UV.
 */
function meshTestResultFaceUvs(
  resultMesh: THREE.Mesh,
  brushId: string,
  surfaceIndex: number,
): Array<{ position: THREE.Vector3; uv: THREE.Vector2 }> {
  const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as SolidTriangleSourceRef[];
  const positions = resultMesh.geometry.getAttribute('position');
  const uvs = resultMesh.geometry.getAttribute('uv');
  const pairs: Array<{ position: THREE.Vector3; uv: THREE.Vector2 }> = [];
  for (let triangle = 0; triangle < getTriangleCount(resultMesh.geometry); triangle++) {
    const source = sources[triangle];
    if (source?.brushId !== brushId || source.surfaceIndex !== surfaceIndex) continue;
    getTriangleVertexIndices(resultMesh.geometry, triangle).forEach((vertex) => {
      pairs.push({
        position: new THREE.Vector3().fromBufferAttribute(positions, vertex),
        uv: new THREE.Vector2(uvs.getX(vertex), uvs.getY(vertex)),
      });
    });
  }
  return pairs;
}

/** Unit tests for the displacement surface geometry. */
describe('DisplacementMeshBuilder', () => {
  it('builds (2^p+1)^2 vertices and two outward triangles per cell for every power', () => {
    const { brush, surfaceIndex } = meshTestBrushCreate();
    for (const power of DISPLACEMENT_POWERS) {
      const displacement = displacementSurfaceCreate(power);
      const placement = DisplacementSurfacePlacement.forModelSpace(brush, surfaceIndex, displacement);
      if (!placement) throw new Error('box face rejected');
      const geometry = DisplacementMeshBuilder.build(placement, displacement, brush.getFaceSurface(surfaceIndex));
      const cellsPerSide = displacementRowLength(power) - 1;
      expect(geometry.getAttribute('position').count).toBe(displacementVertexCount(power));
      expect(getTriangleCount(geometry)).toBe(cellsPerSide * cellsPerSide * 2);
      meshTestTrianglesExpectFacing(geometry, placement.normal);
    }
  });

  it('gives a flat surface the face normal at every vertex', () => {
    const { brush, surfaceIndex } = meshTestBrushCreate();
    const displacement = displacementSurfaceCreate(2, 0.5);
    const placement = DisplacementSurfacePlacement.forModelSpace(brush, surfaceIndex, displacement);
    if (!placement) throw new Error('box face rejected');
    const normals = DisplacementMeshBuilder.build(
      placement,
      displacement,
      brush.getFaceSurface(surfaceIndex),
    ).getAttribute('normal');
    for (let vertex = 0; vertex < normals.count; vertex++) {
      expect(new THREE.Vector3().fromBufferAttribute(normals, vertex).distanceTo(placement.normal)).toBeLessThan(1e-5);
    }
  });

  it('textures the surface exactly like the flat face it replaces', () => {
    const { rig, brush, surfaceIndex } = meshTestBrushCreate();
    const faceUvs = meshTestResultFaceUvs(rig.model.getResultMesh(), brush.id, surfaceIndex);
    const displacement = displacementSurfaceCreate(3);
    const placement = DisplacementSurfacePlacement.forModelSpace(brush, surfaceIndex, displacement);
    if (!placement) throw new Error('box face rejected');
    const uvs = DisplacementMeshBuilder.build(placement, displacement, brush.getFaceSurface(surfaceIndex)).getAttribute(
      'uv',
    );
    let comparedCount = 0;
    placement.basePositions.forEach((base, vertex) => {
      const match = faceUvs.find((pair) => pair.position.distanceTo(base) < 1e-5);
      if (!match) return;
      expect(new THREE.Vector2(uvs.getX(vertex), uvs.getY(vertex)).distanceTo(match.uv)).toBeLessThan(1e-5);
      comparedCount += 1;
    });
    expect(comparedCount).toBe(4);
  });
});

/**
 * Checks that every triangle of a geometry faces along a normal.
 *
 * @param geometry Indexed geometry.
 * @param normal Expected outward direction.
 */
function meshTestTrianglesExpectFacing(geometry: THREE.BufferGeometry, normal: THREE.Vector3): void {
  const positions = geometry.getAttribute('position');
  const triangle = new THREE.Triangle();
  const triangleNormal = new THREE.Vector3();
  for (let index = 0; index < getTriangleCount(geometry); index++) {
    const [a, b, c] = getTriangleVertexIndices(geometry, index);
    triangle.setFromAttributeAndIndices(positions, a, b, c).getNormal(triangleNormal);
    expect(triangleNormal.dot(normal)).toBeGreaterThan(0.999);
  }
}
