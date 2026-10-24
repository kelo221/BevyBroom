import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { IssueProviderFaceUvScale } from '@/info_panel/issues/providers/issue_provider_face_uv_scale.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { getFaceTextureMaps, setFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { createDefaultFaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';

describe('IssueProviderFaceUvScale', () => {
  it('reports no issues for meshes with healthy UV scales', () => {
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    world.add(mesh);
    expect(new IssueProviderFaceUvScale().collect(world)).toEqual([]);
  });

  it('reports a face region whose UV scale collapsed', () => {
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = 'BrokenWall';
    world.add(mesh);
    const healthy = createDefaultFaceTextureMapping('brick.png');
    const collapsed = createDefaultFaceTextureMapping('brick.png');
    collapsed.uv = new SurfaceUvMatrix(new THREE.Vector4(0, 0, 0, 0.5), new THREE.Vector4(0, 1, 0, 0));
    setFaceTextureMaps(mesh, [
      { triangleIndices: [0, 1], mapping: healthy },
      { triangleIndices: [2, 3], mapping: collapsed },
    ]);
    const issues = new IssueProviderFaceUvScale().collect(world);
    expect(issues.length).toBe(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(mesh.uuid);
    expect(issues[0]?.objectName).toBe('BrokenWall');
    expect(issues[0]?.description).toContain('U UV scale');
  });

  it('keeps issue ids stable while the problem stays', () => {
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    world.add(mesh);
    const collapsed = createDefaultFaceTextureMapping('brick.png');
    collapsed.uv = new SurfaceUvMatrix(new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0));
    setFaceTextureMaps(mesh, [{ triangleIndices: [0], mapping: collapsed }]);
    const first = new IssueProviderFaceUvScale().collect(world)[0];
    const second = new IssueProviderFaceUvScale().collect(world)[0];
    expect(first?.id).toBe(second?.id);
    expect(getFaceTextureMaps(mesh).length).toBe(1);
  });
});
