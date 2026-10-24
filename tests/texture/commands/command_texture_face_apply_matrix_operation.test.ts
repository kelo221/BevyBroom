import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CommandTextureFaceApply } from '@/texture/commands/command_texture_face_apply.js';
import { buildTargetsFromMeshes, TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { computeRegionWorldNormal } from '@/texture/uv/planar_uv_projector.js';
import { createWorldPolygonTargetContextFactory } from '@/texture/uv/operations/face_uv_operation_context_factory.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { FaceUvOperationFit } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { FaceUvOperationRotate } from '@/texture/uv/operations/face_uv_operation_rotate.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { SolidModel, SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model.js';
import { serializeFaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { expandFaceSelectionIndices } from '@/selection/face/solid_result_face_indices.js';

describe('CommandTextureFaceApply with matrixOperation', () => {
  it('fits a content mesh face and restores it on undo', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    const targets = buildTargetsFromMeshes([mesh]);
    const before = mappingSnapshot(mesh);
    new CommandTextureFaceApply(targets, undefined, fitOptions()).execute();
    const fittedEntry = topFaceEntry(mesh);
    expect(fittedEntry).toBeDefined();
    const context = faceContextForEntry(mesh, fittedEntry);
    const bounds = context.uvBounds((fittedEntry as { mapping: { uv: SurfaceUvMatrix } }).mapping.uv);
    expect(bounds.maxU - bounds.minU).toBeCloseTo(1, 4);
    expect(mappingSnapshot(mesh)).not.toEqual(before);
  });

  it('undoes a content mesh matrix operation back to the prior UVs', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    const targets = buildTargetsFromMeshes([mesh]);
    const before = uvArraySnapshot(mesh);
    const command = new CommandTextureFaceApply(targets, undefined, fitOptions());
    command.execute();
    command.undo();
    expect(uvArraySnapshot(mesh)).toEqual(before);
  });

  it('applies a matrix operation to solid brush faces and undoes them', () => {
    const model = new SolidModel('MatrixOpSolid');
    const brush = model.addBoxBrush(2, SolidOperation.Additive);
    brush.mesh?.position.set(0, 1, 0);
    brush.mesh?.updateMatrixWorld(true);
    model.rebuild(true);
    const result = model.getResultMeshForSync();
    const triangles = brushTriangles(result, brush.id);
    const mappingBefore = serializeFaceTextureMapping(brush.getSurfaceMapping(0));
    new CommandTextureFaceApply([{ mesh: result, triangleIndices: triangles, previousMapping: null }], undefined, {
      matrixOperation: new FaceUvOperationRotate(90),
      matrixOperationContextFactory: createWorldPolygonTargetContextFactory(null),
    }).execute();
    expect(serializeFaceTextureMapping(brush.getSurfaceMapping(0))).not.toEqual(mappingBefore);
  });

  it('edits two brushes at once and isolates each on undo', () => {
    const model = new SolidModel('MatrixOpMulti');
    const first = model.addBoxBrush(2, SolidOperation.Additive);
    const second = model.addBoxBrush(2, SolidOperation.Additive);
    second.mesh?.position.set(3, 0, 0);
    first.mesh?.updateMatrixWorld(true);
    second.mesh?.updateMatrixWorld(true);
    model.rebuild(true);
    const result = model.getResultMeshForSync();
    const targets: TextureApplyTarget[] = [
      { mesh: result, triangleIndices: brushTriangles(result, first.id), previousMapping: null },
      { mesh: result, triangleIndices: brushTriangles(result, second.id), previousMapping: null },
    ];
    const firstBefore = serializeFaceTextureMapping(first.getSurfaceMapping(0));
    const secondBefore = serializeFaceTextureMapping(second.getSurfaceMapping(0));
    const command = new CommandTextureFaceApply(targets, undefined, fitOptions());
    command.execute();
    expect(serializeFaceTextureMapping(first.getSurfaceMapping(0))).not.toEqual(firstBefore);
    expect(serializeFaceTextureMapping(second.getSurfaceMapping(0))).not.toEqual(secondBefore);
    command.undo();
    expect(serializeFaceTextureMapping(first.getSurfaceMapping(0))).toEqual(firstBefore);
    expect(serializeFaceTextureMapping(second.getSurfaceMapping(0))).toEqual(secondBefore);
  });
});

/**
 * Builds command options running a fit on both axes.
 *
 * @returns Apply options.
 */
function fitOptions(): {
  matrixOperation: FaceUvOperationFit;
  matrixOperationContextFactory: ReturnType<typeof createWorldPolygonTargetContextFactory>;
} {
  return {
    matrixOperation: new FaceUvOperationFit({ axis: 'both' }),
    matrixOperationContextFactory: createWorldPolygonTargetContextFactory(null),
  };
}

/**
 * Expands a brush's seed triangle into its result-mesh region.
 *
 * @param result Solid result mesh.
 * @param brushId Brush identity.
 * @returns Region triangle indices.
 */
function brushTriangles(result: THREE.Mesh, brushId: string): number[] {
  const sources =
    (result.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as Array<{ brushId: string; surfaceIndex: number }>) ?? [];
  const seed = sources.findIndex((source) => source.brushId === brushId);
  expect(seed).toBeGreaterThanOrEqual(0);
  return expandFaceSelectionIndices(result, seed);
}

/**
 * Snapshots every stored mapping of a mesh.
 *
 * @param mesh Mesh to snapshot.
 * @returns Serialized mapping table.
 */
function mappingSnapshot(mesh: THREE.Mesh): string {
  return JSON.stringify(getFaceTextureMaps(mesh).map((entry) => entry.mapping.uv.serialize()));
}

/**
 * Snapshots the mesh UV buffer.
 *
 * @param mesh Mesh to snapshot.
 * @returns Serialized UV values.
 */
function uvArraySnapshot(mesh: THREE.Mesh): string {
  return JSON.stringify(Array.from((mesh.geometry.getAttribute('uv')?.array as ArrayLike<number>) ?? []));
}

/**
 * Finds the face map entry covering the box top face.
 *
 * @param mesh Box mesh.
 * @returns Stored entry of the top region.
 */
function topFaceEntry(mesh: THREE.Mesh): ReturnType<typeof getFaceTextureMaps>[number] | undefined {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  return getFaceTextureMaps(mesh).find((entry) => {
    const seed = entry.triangleIndices[0];
    if (seed === undefined) {
      return false;
    }
    const vertexIndex = index ? index.getX(seed * 3) : seed * 3;
    return position.getY(vertexIndex) > 0.9;
  });
}

/**
 * Builds the face context of a stored box top face entry.
 *
 * @param mesh Box mesh.
 * @param entry Stored top face entry.
 * @returns Context of the entry region.
 */
function faceContextForEntry(
  mesh: THREE.Mesh,
  entry: { triangleIndices: number[] } | undefined,
): FaceUvOperationContext {
  const triangles = entry?.triangleIndices ?? [];
  return new FaceUvOperationContext({
    vertices: topFaceWorldCorners(mesh),
    faceNormal: computeRegionWorldNormal(mesh, triangles),
  });
}

/**
 * Collects the world corners of a box top face.
 *
 * @param mesh Box mesh.
 * @returns Corner positions.
 */
function topFaceWorldCorners(mesh: THREE.Mesh): THREE.Vector3[] {
  return [
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(-1, 1, 1),
  ].map((corner) => corner.clone().applyMatrix4(mesh.matrixWorld));
}
