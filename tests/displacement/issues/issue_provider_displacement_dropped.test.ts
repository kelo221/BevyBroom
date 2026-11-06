import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import { getTriangleCount } from '@/selection/pick/utils_triangle_geometry.js';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { IssueProviderDisplacementDropped } from '@/displacement/issues/issue_provider_displacement_dropped.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../displacement_test_rig.js';

/** Restored model whose one displaced face carried a malformed displacement. */
interface DroppedDisplacementParts {
  restored: SolidModel;
  world: THREE.Group;
  brushName: string;
  surfaceIndex: number;
  faceArea: number;
}

/**
 * Saves a box with one displaced face, breaks that face's saved displacement
 * and loads the model again into a new world.
 *
 * @returns Restored model, its world, the broken face and its flat area.
 */
function droppedDisplacementPartsCreate(): DroppedDisplacementParts {
  const rig = displacementTestRigCreate('DroppedDisplacement');
  const edges = new THREE.Vector3(3, 2, 5);
  const brush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(-2, 1, 3));
  const surfaceIndex = displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0));
  displacementTestCreate(rig, displacementTestTarget(rig, brush, surfaceIndex), 2);
  const encoded = SolidModelCodec.encode(rig.model);
  const serializedBrush = encoded.brushes[0];
  if (!serializedBrush?.faceDisplacements) throw new Error('displacement missing from encoding');
  serializedBrush.faceDisplacements[surfaceIndex] = { ...displacementSurfaceCreate(2), offsets: [1, 2] };
  const restored = SolidModelCodec.decode(encoded, 'DroppedDisplacementRestored');
  const world = new THREE.Group();
  world.add(restored.root);
  return { restored, world, brushName: brush.name, surfaceIndex, faceArea: edges.x * edges.z };
}

/**
 * Sums the area of the result triangles that come from one brush face.
 *
 * @param resultMesh Solid result mesh.
 * @param surfaceIndex Brush face index.
 * @returns Total area in the mesh's space.
 */
function faceTrianglesAreaSum(resultMesh: THREE.Mesh, surfaceIndex: number): number {
  const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as SolidTriangleSourceRef[];
  const position = resultMesh.geometry.getAttribute('position');
  const index = resultMesh.geometry.getIndex();
  const triangle = new THREE.Triangle();
  let area = 0;
  sources.forEach((source, triangleIndex) => {
    if (source.surfaceIndex !== surfaceIndex) return;
    const corners = [0, 1, 2].map((corner) => index?.getX(triangleIndex * 3 + corner) ?? triangleIndex * 3 + corner);
    triangle.setFromAttributeAndIndices(position, corners[0] ?? 0, corners[1] ?? 0, corners[2] ?? 0);
    area += triangle.getArea();
  });
  return area;
}

/** Loading saved displacements that are malformed. */
describe('IssueProviderDisplacementDropped', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns and reports the brush and face of a dropped displacement', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { restored, world, brushName, surfaceIndex } = droppedDisplacementPartsCreate();
    const warnings = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(warnings.some((text) => text.includes(brushName) && text.includes(`face ${surfaceIndex}`))).toBe(true);
    expect(restored.getBrushes()[0]?.faceDisplacementsDroppedRead()).toEqual([surfaceIndex]);
    const issues = new IssueProviderDisplacementDropped().collect(world);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectName).toBe(brushName);
    expect(issues[0]?.description).toContain(`face ${surfaceIndex}`);
  });

  it('shows and exports the face as flat geometry after dropping its displacement', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { restored, world, surfaceIndex, faceArea } = droppedDisplacementPartsCreate();
    const resultMesh = restored.getResultMesh();
    expect(faceTrianglesAreaSum(resultMesh, surfaceIndex)).toBeCloseTo(faceArea, 4);
    expect(displacementSurfaceMeshesUnder(restored.root)).toHaveLength(0);
    const exportRoot = buildExportScene(world);
    const exportedMeshes: THREE.Mesh[] = [];
    exportRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) exportedMeshes.push(child);
    });
    expect(exportedMeshes.some((mesh) => mesh.name.startsWith('displacement:'))).toBe(false);
    const exportedTriangles = exportedMeshes.reduce((total, mesh) => total + getTriangleCount(mesh.geometry), 0);
    expect(exportedTriangles).toBe(getTriangleCount(resultMesh.geometry));
  });

  it('forgets a dropped face once it receives a new displacement', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { restored, world, surfaceIndex } = droppedDisplacementPartsCreate();
    restored.getBrushes()[0]?.faceDisplacementWrite(surfaceIndex, displacementSurfaceCreate(2));
    expect(new IssueProviderDisplacementDropped().collect(world)).toEqual([]);
  });
});
