import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildExportScene, EXPORT_STATIC_MESH_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshIs } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementExportResultFilter } from '@/displacement/export/displacement_export_result_filter.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/**
 * Builds a box whose upward face carries a displacement of the given power.
 *
 * @param power Subdivision power.
 * @returns Rig and displaced face.
 */
function exportTestRigCreate(power: 2 | 3): { rig: DisplacementTestRig; target: SolidFaceTextureTarget } {
  const rig = displacementTestRigCreate('ExportDisplacement');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 1, 3), new THREE.Vector3(2, 0, -1));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  displacementTestCreate(rig, target, power);
  return { rig, target };
}

/**
 * Counts the result triangles that come from one brush face.
 *
 * @param resultMesh Solid result mesh.
 * @param target Brush face.
 * @returns Triangle count of that face.
 */
function exportTestFaceTriangleCount(resultMesh: THREE.Mesh, target: SolidFaceTextureTarget): number {
  const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as SolidTriangleSourceRef[];
  return sources.filter((source) => source.brushId === target.brushId && source.surfaceIndex === target.surfaceIndex)
    .length;
}

/**
 * Splits the meshes of the exported solid group into result and surface meshes.
 *
 * @param exportRoot Export scene root.
 * @returns Exported meshes.
 */
function exportTestSolidMeshesRead(exportRoot: THREE.Group): { result: THREE.Mesh; surfaces: THREE.Mesh[] } {
  const solidGroup = exportRoot.children[0];
  const meshes = (solidGroup?.children ?? []).filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const surfaces = meshes.filter((mesh) => mesh.name.startsWith('displacement:'));
  const result = meshes.find((mesh) => !surfaces.includes(mesh));
  if (!result) throw new Error('export has no result mesh');
  return { result, surfaces };
}

/** Export of displaced faces: surface meshes replace the faces' own triangles. */
describe('DisplacementExportResultFilter', () => {
  it('exports one displacement mesh per displaced face and drops the face triangles from the result', () => {
    for (const power of [2, 3] as const) {
      const { rig, target } = exportTestRigCreate(power);
      const liveResult = rig.model.getResultMesh();
      const liveTriangleCount = getTriangleCount(liveResult.geometry);
      const faceTriangleCount = exportTestFaceTriangleCount(liveResult, target);
      expect(faceTriangleCount).toBeGreaterThan(0);
      const exported = exportTestSolidMeshesRead(buildExportScene(rig.world));
      expect(exported.surfaces).toHaveLength(1);
      expect(exported.surfaces[0]?.geometry.getAttribute('position').count).toBe(displacementVertexCount(power));
      expect(exported.surfaces[0]?.userData[EXPORT_STATIC_MESH_EXTRAS_KEY]).toBe(true);
      expect(getTriangleCount(exported.result.geometry)).toBe(liveTriangleCount - faceTriangleCount);
      expect(getTriangleCount(liveResult.geometry)).toBe(liveTriangleCount);
    }
  });

  it('keeps every draw group inside the filtered geometry', () => {
    const { rig } = exportTestRigCreate(2);
    const filtered = DisplacementExportResultFilter.geometryRead(rig.model.getResultMesh(), rig.model.root);
    const vertexCount = filtered.getAttribute('position').count;
    const groupedVertexCount = filtered.groups.reduce((total, group) => total + group.count, 0);
    expect(groupedVertexCount).toBe(vertexCount);
    filtered.groups.forEach((group) => expect(group.start + group.count).toBeLessThanOrEqual(vertexCount));
  });

  it('returns the live geometry unchanged for models without displacements', () => {
    const rig = displacementTestRigCreate('ExportFlat');
    displacementTestBoxAdd(rig, new THREE.Vector3(1, 2, 1), new THREE.Vector3(0, 0, 0));
    const resultMesh = rig.model.getResultMesh();
    expect(DisplacementExportResultFilter.geometryRead(resultMesh, rig.model.root)).toBe(resultMesh.geometry);
  });

  it('adds lightmap UVs to the displacement mesh and the filtered result', () => {
    const { rig } = exportTestRigCreate(3);
    const exported = exportTestSolidMeshesRead(buildExportScene(rig.world, { includeLightmapUvs: true }));
    expect(exported.result.geometry.getAttribute('uv1')).toBeDefined();
    exported.surfaces.forEach((surface) => expect(surface.geometry.getAttribute('uv1')).toBeDefined());
    expect(SolidModel.isResultMesh(exported.result)).toBe(false);
    exported.surfaces.forEach((surface) => expect(displacementSurfaceMeshIs(surface)).toBe(false));
  });
});
