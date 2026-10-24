import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CommandTextureFaceAttributeTransfer } from '@/texture/commands/command_texture_face_attribute_transfer.js';
import { buildTargetsFromFaceSelection, type TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps, upsertFaceTextureMap } from '@/texture/uv/face_texture_storage.js';
import { getFaceTextureMappingTrs } from '@/texture/uv/face_texture_mapping.js';

describe('CommandTextureFaceAttributeTransfer', () => {
  it('copies material and alignment onto another face of the same mesh', () => {
    const mesh = createBoxWithFaces();
    const sourceTarget = regionTarget(mesh, faceSeed(mesh, 'top'));
    const destinationTarget = regionTarget(mesh, faceSeed(mesh, 'bottom'));
    paintRegion(mesh, sourceTarget, 'walls/brick.png', 3);
    const command = new CommandTextureFaceAttributeTransfer(sourceTarget, [destinationTarget]);
    command.execute();
    const destination = regionMapping(mesh, destinationTarget);
    expect(destination.textureId).toBe('walls/brick.png');
    const source = regionMapping(mesh, sourceTarget);
    expect(getFaceTextureMappingTrs(destination, new THREE.Vector3(0, 1, 0)).scaleU).toBeCloseTo(
      getFaceTextureMappingTrs(source, new THREE.Vector3(0, 1, 0)).scaleU,
      3,
    );
  });

  it('restores the prior mapping on undo', () => {
    const mesh = createBoxWithFaces();
    const sourceTarget = regionTarget(mesh, faceSeed(mesh, 'top'));
    const destinationTarget = regionTarget(mesh, faceSeed(mesh, 'bottom'));
    paintRegion(mesh, sourceTarget, 'walls/brick.png', 3);
    const before = mappingSnapshot(mesh);
    const command = new CommandTextureFaceAttributeTransfer(sourceTarget, [destinationTarget]);
    command.execute();
    expect(mappingSnapshot(mesh)).not.toBe(before);
    command.undo();
    expect(mappingSnapshot(mesh)).toBe(before);
  });

  it('transfers onto a face of another mesh', () => {
    const sourceMesh = createBoxWithFaces();
    const destinationMesh = createBoxWithFaces();
    destinationMesh.position.set(5, 0, 0);
    destinationMesh.updateMatrixWorld(true);
    const sourceTarget = regionTarget(sourceMesh, faceSeed(sourceMesh, 'top'));
    const destinationTarget = regionTarget(destinationMesh, faceSeed(destinationMesh, 'top'));
    paintRegion(sourceMesh, sourceTarget, 'floors/concrete.png', 4);
    new CommandTextureFaceAttributeTransfer(sourceTarget, [destinationTarget]).execute();
    expect(regionMapping(destinationMesh, destinationTarget).textureId).toBe('floors/concrete.png');
  });
});

/**
 * Creates a textured box mesh with per-face maps initialized.
 *
 * @returns Box mesh ready for face region edits.
 */
function createBoxWithFaces(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld(true);
  initializeMeshTextureUVs(mesh, 'checker');
  return mesh;
}

/**
 * Finds the seed triangle of a named box face.
 *
 * @param mesh Box mesh.
 * @param faceName Top or bottom face selector.
 * @returns Triangle index of the face.
 */
function faceSeed(mesh: THREE.Mesh, faceName: 'top' | 'bottom'): number {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  let targetY = faceName === 'top' ? -Infinity : Infinity;
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex++) {
    const y = position.getY(vertexIndex);
    targetY = faceName === 'top' ? Math.max(targetY, y) : Math.min(targetY, y);
  }
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const corners = [0, 1, 2].map((corner) =>
      position.getY(index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner),
    );
    if (corners.every((y) => Math.abs(y - targetY) < 1e-4)) {
      return triangleIndex;
    }
  }
  throw new Error(`face not found: ${faceName}`);
}

/**
 * Builds one apply target for the coplanar region of a seed triangle.
 *
 * @param mesh Mesh owner.
 * @param seedTriangle Seed triangle index.
 * @returns Apply target.
 */
function regionTarget(mesh: THREE.Mesh, seedTriangle: number): TextureApplyTarget {
  const target = buildTargetsFromFaceSelection([{ mesh, faceIndex: seedTriangle }])[0];
  if (!target) {
    throw new Error('region target missing');
  }
  return target;
}

/**
 * Writes a distinct material and scale onto one region.
 *
 * @param mesh Mesh owner.
 * @param target Region to paint.
 * @param textureId Material identity.
 * @param scaleU U scale in meters per tile.
 */
function paintRegion(mesh: THREE.Mesh, target: { triangleIndices: number[] }, textureId: string, scaleU: number): void {
  if (!target) {
    throw new Error('region target missing');
  }
  const mapping = getFaceTextureMaps(mesh).find((entry) =>
    entry.triangleIndices.some((index) => target.triangleIndices.includes(index)),
  );
  if (!mapping) {
    throw new Error('region mapping missing');
  }
  mapping.mapping.textureId = textureId;
  const trs = getFaceTextureMappingTrs(mapping.mapping, new THREE.Vector3(0, 1, 0));
  mapping.mapping.scaleU = scaleU;
  mapping.mapping.scaleV = trs.scaleV;
  upsertFaceTextureMap(mesh, target.triangleIndices, mapping.mapping);
}

/**
 * Reads the stored mapping covering a region.
 *
 * @param mesh Mesh owner.
 * @param target Region to read.
 * @returns Stored mapping.
 */
function regionMapping(mesh: THREE.Mesh, target: { triangleIndices: number[] }) {
  const entry = getFaceTextureMaps(mesh).find((candidate) =>
    candidate.triangleIndices.some((index) => target?.triangleIndices.includes(index)),
  );
  if (!entry) {
    throw new Error('region mapping missing');
  }
  return entry.mapping;
}

/**
 * Snapshots the mesh mapping table.
 *
 * @param mesh Mesh to snapshot.
 * @returns Serialized mappings.
 */
function mappingSnapshot(mesh: THREE.Mesh): string {
  return JSON.stringify(getFaceTextureMaps(mesh).map((entry) => [entry.triangleIndices, entry.mapping.uv.serialize()]));
}
