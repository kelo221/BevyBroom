import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FaceRegionWorldGeometry } from '@/selection/face/face_region_world_geometry.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import { expandFaceSelectionIndices } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../displacement/displacement_test_rig.js';

/** Box, displaced bottom face and its result region. */
interface DisplacedRegionParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  triangles: number[];
  bottomCenter: THREE.Vector3;
}

/**
 * Builds a box whose bottom face carries a displacement and returns the result
 * region of that face.
 *
 * @returns Rig, target, region triangles and the expected flat face center.
 */
function displacedRegionPartsCreate(): DisplacedRegionParts {
  const rig = displacementTestRigCreate('RegionGeometry');
  const edges = new THREE.Vector3(2, 3, 4);
  const center = new THREE.Vector3(1, 5, -2);
  const brush = displacementTestBoxAdd(rig, edges, center);
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, -1, 0)));
  displacementTestCreate(rig, target, 2);
  const resultMesh = rig.model.getResultMesh();
  const seed = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
  const triangles = expandFaceSelectionIndices(resultMesh, seed);
  const bottomCenter = center.clone().add(new THREE.Vector3(0, -edges.y / 2, 0));
  return { rig, target, triangles, bottomCenter };
}

/**
 * Sums the areas of world triangles listed three corners at a time.
 *
 * @param corners Corner positions, three per triangle.
 * @returns Total area.
 */
function trianglesAreaSum(corners: THREE.Vector3[]): number {
  let area = 0;
  for (let index = 0; index + 2 < corners.length; index += 3) {
    const [first, second, third] = [corners[index], corners[index + 1], corners[index + 2]];
    if (first && second && third) {
      area += new THREE.Triangle(first, second, third).getArea();
    }
  }
  return area;
}

/** World shape of face regions, including displaced brush faces. */
describe('FaceRegionWorldGeometry', () => {
  it('averages indexed triangle corners into the region center', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    mesh.position.set(3, -1, 4);
    expect(FaceRegionWorldGeometry.centerWorld(mesh, [0, 1]).distanceTo(mesh.position)).toBeLessThan(1e-6);
  });

  it('averages non-indexed triangle corners into the region center', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).toNonIndexed());
    mesh.position.set(-2, 6, 1);
    expect(FaceRegionWorldGeometry.centerWorld(mesh, [0, 1]).distanceTo(mesh.position)).toBeLessThan(1e-6);
  });

  it('returns the origin for an empty region', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    mesh.position.set(5, 5, 5);
    expect(FaceRegionWorldGeometry.centerWorld(mesh, []).length()).toBe(0);
  });

  it('describes a displaced face by its flat brush face', () => {
    const { rig, triangles, bottomCenter } = displacedRegionPartsCreate();
    const resultMesh = rig.model.getResultMesh();
    const normal = FaceRegionWorldGeometry.normalWorld(resultMesh, triangles);
    expect(normal.distanceTo(new THREE.Vector3(0, -1, 0))).toBeLessThan(1e-6);
    expect(FaceRegionWorldGeometry.cornersWorld(resultMesh, triangles)).toHaveLength(4);
    expect(FaceRegionWorldGeometry.centerWorld(resultMesh, triangles).distanceTo(bottomCenter)).toBeLessThan(1e-6);
  });

  it('overlays a displaced face with its displacement surface triangles', () => {
    const { rig, target, triangles } = displacedRegionPartsCreate();
    const resultMesh = rig.model.getResultMesh();
    const surfaceMesh = displacementTestSurfaceMeshFind(rig, target);
    if (!surfaceMesh) throw new Error('surface mesh missing');
    const overlay = FaceRegionWorldGeometry.overlayTrianglesWorld(resultMesh, triangles);
    expect(overlay).toHaveLength(getTriangleCount(surfaceMesh.geometry) * 3);
    expect(trianglesAreaSum(overlay)).toBeGreaterThan(1);
    expect(FaceRegionWorldGeometry.overlaySourceIdRead(resultMesh, triangles)).toBe(surfaceMesh.geometry.uuid);
  });
});
