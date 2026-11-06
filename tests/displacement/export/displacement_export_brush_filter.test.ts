import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildExportScene, EXPORT_STATIC_MESH_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshIs } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementExportBrushFilter } from '@/displacement/export/displacement_export_brush_filter.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Rig with a displaced brush and, optionally, an untouched neighbour brush. */
interface ExportTestScene {
  /** Test rig. */
  rig: DisplacementTestRig;
  /** Brush whose upward face carries a displacement. */
  displacedBrush: SolidBrushInstance;
  /** Untouched brush in the same model, or null. */
  neighbourBrush: SolidBrushInstance | null;
}

/**
 * Builds a model whose first box has a displaced upward face, optionally beside
 * a second box that stays flat and does not touch the first.
 *
 * @param power Subdivision power.
 * @param withNeighbour True to add the untouched neighbour brush.
 * @returns Rig and brushes.
 */
function exportTestSceneCreate(power: 2 | 3, withNeighbour: boolean): ExportTestScene {
  const rig = displacementTestRigCreate('ExportDisplacement');
  const edges = new THREE.Vector3(4, 1, 3);
  const displacedBrush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(0, 0, 0));
  const neighbourCenter = new THREE.Vector3(edges.x * 3, 0, 0);
  const neighbourBrush = withNeighbour ? displacementTestBoxAdd(rig, edges, neighbourCenter) : null;
  const upward = displacementTestFaceFacing(displacedBrush, new THREE.Vector3(0, 1, 0));
  displacementTestCreate(rig, displacementTestTarget(rig, displacedBrush, upward), power);
  return { rig, displacedBrush, neighbourBrush };
}

/**
 * Counts the result triangles that come from one brush.
 *
 * @param resultMesh Live solid result mesh.
 * @param brushId Brush id.
 * @returns Triangle count of that brush.
 */
function exportTestBrushTriangleCount(resultMesh: THREE.Mesh, brushId: string): number {
  const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as SolidTriangleSourceRef[];
  return sources.filter((source) => source.brushId === brushId).length;
}

/**
 * Splits the meshes of the exported solid group into result and surface meshes.
 *
 * @param exportRoot Export scene root.
 * @returns Exported result mesh, or null when it was left out, and surfaces.
 */
function exportTestSolidMeshesRead(exportRoot: THREE.Group): { result: THREE.Mesh | null; surfaces: THREE.Mesh[] } {
  const solidGroup = exportRoot.children[0];
  const meshes = (solidGroup?.children ?? []).filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const surfaces = meshes.filter((mesh) => mesh.name.startsWith('displacement:'));
  const result = meshes.find((mesh) => !surfaces.includes(mesh)) ?? null;
  return { result, surfaces };
}

/**
 * Returns the exported result mesh or fails the test when it is missing.
 *
 * @param exported Exported solid meshes.
 * @returns Exported result mesh.
 */
function exportTestResultRequire(exported: { result: THREE.Mesh | null }): THREE.Mesh {
  if (!exported.result) throw new Error('export has no result mesh');
  return exported.result;
}

/** Export of displaced brushes: only displacement surfaces represent them. */
describe('DisplacementExportBrushFilter', () => {
  it('drops every triangle of a displaced brush and keeps every triangle of its neighbour', () => {
    for (const power of [2, 3] as const) {
      const { rig, displacedBrush, neighbourBrush } = exportTestSceneCreate(power, true);
      if (!neighbourBrush) throw new Error('neighbour brush missing');
      const liveResult = rig.model.getResultMesh();
      const liveTriangleCount = getTriangleCount(liveResult.geometry);
      const displacedTriangleCount = exportTestBrushTriangleCount(liveResult, displacedBrush.id);
      expect(displacedTriangleCount).toBeGreaterThan(0);
      expect(exportTestBrushTriangleCount(liveResult, neighbourBrush.id)).toBeGreaterThan(0);
      const exported = exportTestSolidMeshesRead(buildExportScene(rig.world));
      expect(exported.surfaces).toHaveLength(1);
      expect(exported.surfaces[0]?.geometry.getAttribute('position').count).toBe(displacementVertexCount(power));
      expect(exported.surfaces[0]?.userData[EXPORT_STATIC_MESH_EXTRAS_KEY]).toBe(true);
      const exportedResult = exportTestResultRequire(exported);
      expect(getTriangleCount(exportedResult.geometry)).toBe(liveTriangleCount - displacedTriangleCount);
      expect(getTriangleCount(liveResult.geometry)).toBe(liveTriangleCount);
    }
  });

  it('leaves the result mesh out when its only brush is displaced', () => {
    const { rig } = exportTestSceneCreate(2, false);
    expect(getTriangleCount(rig.model.getResultMesh().geometry)).toBeGreaterThan(0);
    const exported = exportTestSolidMeshesRead(buildExportScene(rig.world));
    expect(exported.result).toBeNull();
    expect(exported.surfaces).toHaveLength(1);
  });

  it('lists exactly the displaced brushes of a model', () => {
    const { rig, displacedBrush } = exportTestSceneCreate(2, true);
    expect([...DisplacementExportBrushFilter.displacedBrushIdsRead(rig.model.root)]).toEqual([displacedBrush.id]);
  });

  it('keeps every draw group inside the filtered geometry', () => {
    const { rig } = exportTestSceneCreate(2, true);
    const filtered = DisplacementExportBrushFilter.geometryRead(rig.model.getResultMesh(), rig.model.root);
    const vertexCount = filtered.getAttribute('position').count;
    const groupedVertexCount = filtered.groups.reduce((total, group) => total + group.count, 0);
    expect(groupedVertexCount).toBe(vertexCount);
    filtered.groups.forEach((group) => expect(group.start + group.count).toBeLessThanOrEqual(vertexCount));
  });

  it('returns the live geometry unchanged for models without displacements', () => {
    const rig = displacementTestRigCreate('ExportFlat');
    displacementTestBoxAdd(rig, new THREE.Vector3(1, 2, 1), new THREE.Vector3(0, 0, 0));
    const resultMesh = rig.model.getResultMesh();
    expect(DisplacementExportBrushFilter.geometryRead(resultMesh, rig.model.root)).toBe(resultMesh.geometry);
  });

  it('adds lightmap UVs to the displacement mesh and the filtered result', () => {
    const { rig } = exportTestSceneCreate(3, true);
    const exported = exportTestSolidMeshesRead(buildExportScene(rig.world, { includeLightmapUvs: true }));
    const exportedResult = exportTestResultRequire(exported);
    expect(exportedResult.geometry.getAttribute('uv1')).toBeDefined();
    exported.surfaces.forEach((surface) => expect(surface.geometry.getAttribute('uv1')).toBeDefined());
    expect(SolidModel.isResultMesh(exportedResult)).toBe(false);
    exported.surfaces.forEach((surface) => expect(displacementSurfaceMeshIs(surface)).toBe(false));
  });
});
