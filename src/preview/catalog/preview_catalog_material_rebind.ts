import * as THREE from 'three';
import { exportContentMaterialResolve } from '@/io/scene/builder_export_scene.js';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Points every content material whose identity is one of the given ids at the
 * map the cache resolves for that id, so surfaces assigned a game material
 * before its texture was available show the texture without being rebuilt.
 *
 * @param worldGroup Editor world root.
 * @param materialIdentifiers Identities whose maps are refreshed.
 * @param cache Texture map cache.
 * @returns Number of materials updated.
 */
export function previewCatalogMaterialsRebind(
  worldGroup: THREE.Object3D,
  materialIdentifiers: ReadonlySet<string>,
  cache: TextureMapCache,
): number {
  let updatedCount = 0;
  worldGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      updatedCount += previewCatalogMeshRebind(object, materialIdentifiers, cache);
    }
  });
  return updatedCount;
}

/**
 * Refreshes the maps of one mesh's content materials.
 *
 * @param mesh Mesh to update.
 * @param materialIdentifiers Identities whose maps are refreshed.
 * @param cache Texture map cache.
 * @returns Number of materials updated.
 */
function previewCatalogMeshRebind(
  mesh: THREE.Mesh,
  materialIdentifiers: ReadonlySet<string>,
  cache: TextureMapCache,
): number {
  const materials = exportContentMaterialResolve(mesh);
  let updatedCount = 0;
  for (const material of Array.isArray(materials) ? materials : [materials]) {
    const identifier = materialIdentityRead(material);
    const host = material as THREE.Material & { map?: THREE.Texture | null };
    if (identifier === null || !materialIdentifiers.has(identifier) || !('map' in host)) {
      continue;
    }
    const map = cache.resolve(identifier);
    if (host.map !== map) {
      host.map = map;
      material.needsUpdate = true;
      updatedCount += 1;
    }
  }
  return updatedCount;
}
