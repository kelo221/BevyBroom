import * as THREE from 'three';
import { writeContentMeshTextureId } from '@/texture/uv/content_mesh_texture.js';
import { rebuildSurfaceMaterials } from '@/texture/material/builder_surface_material.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Texture cache stand-in: game materials are drawn by the game, so no map is
 * needed.
 */
const previewE2eTextureCacheWithoutMaps = { resolve: () => null } as unknown as TextureMapCache;

/**
 * Creates a box mesh assigned a game material the editor's way.
 *
 * @param name Object name.
 * @param materialIdentifier Game material id.
 * @param position Box center.
 * @param size Full box size in meters.
 * @returns Content mesh.
 */
export function previewE2eGameMaterialBoxCreate(
  name: string,
  materialIdentifier: string,
  position: THREE.Vector3,
  size: THREE.Vector3,
): THREE.Mesh {
  const box = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  box.name = name;
  box.position.copy(position);
  writeContentMeshTextureId(box, materialIdentifier);
  rebuildSurfaceMaterials(box, previewE2eTextureCacheWithoutMaps, 0xffffff);
  return box;
}
