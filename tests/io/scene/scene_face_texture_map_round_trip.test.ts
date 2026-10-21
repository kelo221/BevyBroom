import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { writeContentMeshTextureId, readContentMeshTextureId } from '@/texture/uv/content_mesh_texture.js';
import { getFaceTextureMaps, getFaceTextureMapsLive } from '@/texture/uv/face_texture_storage.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';

/**
 * Saves a world to JSON text and loads it into a new world, exactly as the
 * editor's save and load do.
 *
 * @param world World to save.
 * @returns The loaded world.
 */
function worldSaveAndLoad(world: THREE.Group): THREE.Group {
  const text = JSON.stringify(new SceneSerializer().serialize(world));
  const loaded = new THREE.Group();
  new SceneDeserializer().deserialize(JSON.parse(text), loaded);
  return loaded;
}

describe('scene face texture maps through JSON', () => {
  it('restores the texture id and UV matrix of a free mesh saved as JSON text', () => {
    const world = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    world.add(mesh);
    writeContentMeshTextureId(mesh, 'stone/castle_wall');
    const sourceMapping = getFaceTextureMapsLive(mesh)[0]?.mapping;
    expect(sourceMapping).toBeDefined();
    if (!sourceMapping) return;
    sourceMapping.uv.u.set(0.5, 0, 0, 0.25);
    const loaded = worldSaveAndLoad(world);
    const loadedMesh = loaded.getObjectByProperty('uuid', mesh.uuid);
    expect(loadedMesh).toBeInstanceOf(THREE.Mesh);
    if (!(loadedMesh instanceof THREE.Mesh)) return;
    expect(readContentMeshTextureId(loadedMesh)).toBe('stone/castle_wall');
    const loadedMapping = getFaceTextureMaps(loadedMesh)[0]?.mapping;
    expect(loadedMapping?.uv).toBeInstanceOf(SurfaceUvMatrix);
    expect(loadedMapping?.uv.u.toArray()).toEqual(sourceMapping.uv.u.toArray());
    expect(loadedMapping?.uv.v.toArray()).toEqual(sourceMapping.uv.v.toArray());
  });
});
