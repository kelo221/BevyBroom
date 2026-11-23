import * as THREE from 'three';
import { exportContentMaterialResolve } from '@/io/scene/export_content_material_resolve.js';
import { isContentViewLitMaterial } from '@/materials/factory_content_view_lit_material.js';
import { materialIdentityRead } from '@/materials/identity/material_identity.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Points every content material whose identity is one of the given ids at the
 * map the cache resolves for that id and makes it see-through when that id is a
 * blended material, so surfaces assigned a game material before it was
 * available show it without being rebuilt.
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
 * Refreshes the maps and see-through state of one mesh's content materials.
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
    if (identifier === null || !materialIdentifiers.has(identifier)) {
      continue;
    }
    const isMapUpdated = previewCatalogMaterialMapRebind(material, identifier, cache);
    const isTranslucencyUpdated = previewCatalogMaterialTranslucencyRebind(material, identifier, cache);
    updatedCount += isMapUpdated || isTranslucencyUpdated ? 1 : 0;
  }
  return updatedCount;
}

/**
 * Points one material at the map the cache resolves for its identity.
 *
 * @param material Content material.
 * @param identifier Identity of the material.
 * @param cache Texture map cache.
 * @returns True when the map changed.
 */
function previewCatalogMaterialMapRebind(
  material: THREE.Material,
  identifier: string,
  cache: TextureMapCache,
): boolean {
  const host = material as THREE.Material & { map?: THREE.Texture | null };
  if (!('map' in host)) {
    return false;
  }
  const map = cache.resolve(identifier);
  if (host.map === map) {
    return false;
  }
  host.map = map;
  material.needsUpdate = true;
  return true;
}

/**
 * Makes one material see-through or opaque the way the cache's entry for its
 * identity says.
 *
 * @param material Content material.
 * @param identifier Identity of the material.
 * @param cache Texture map cache.
 * @returns True when the see-through state changed.
 */
function previewCatalogMaterialTranslucencyRebind(
  material: THREE.Material,
  identifier: string,
  cache: TextureMapCache,
): boolean {
  const opacity = cache.blendOpacityOf(identifier);
  if (!isContentViewLitMaterial(material) || material.translucencyRead() === opacity) {
    return false;
  }
  material.translucencySet(opacity);
  material.needsUpdate = true;
  return true;
}
