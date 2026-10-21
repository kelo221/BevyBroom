import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { previewCatalogMaterialsRebind } from '@/preview/catalog/preview_catalog_material_rebind.js';
import { materialIdentityWrite } from '@/materials/identity/material_identity.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';

/**
 * Creates a cache stand-in that resolves every id to its own texture.
 *
 * @param texturesByIdentifier Textures returned per id.
 * @returns Object usable where a texture map cache is expected.
 */
function cacheCreate(texturesByIdentifier: Map<string, THREE.Texture>): TextureMapCache {
  return {
    resolve: (identifier: string) => texturesByIdentifier.get(identifier) ?? null,
  } as unknown as TextureMapCache;
}

/**
 * Creates a box mesh whose material carries a game material identity.
 *
 * @param identifier Game material id.
 * @returns Mesh with one standard material.
 */
function meshWithIdentityCreate(identifier: string): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
  const material = new THREE.MeshStandardMaterial();
  materialIdentityWrite(material, identifier);
  return new THREE.Mesh(new THREE.BoxGeometry(), material);
}

describe('previewCatalogMaterialsRebind', () => {
  it('points only materials with a listed identity at the resolved map', () => {
    const world = new THREE.Group();
    const listedMesh = meshWithIdentityCreate('stone_wall');
    const unlistedMesh = meshWithIdentityCreate('wood_floor');
    world.add(listedMesh, unlistedMesh);
    const stoneTexture = new THREE.Texture();
    const cache = cacheCreate(new Map([['stone_wall', stoneTexture]]));
    const versionBefore = listedMesh.material.version;
    const updatedCount = previewCatalogMaterialsRebind(world, new Set(['stone_wall']), cache);
    expect(updatedCount).toBe(1);
    expect(listedMesh.material.map).toBe(stoneTexture);
    expect(listedMesh.material.version).toBeGreaterThan(versionBefore);
    expect(unlistedMesh.material.map).toBeNull();
  });

  it('leaves materials alone when their map is already current', () => {
    const world = new THREE.Group();
    const mesh = meshWithIdentityCreate('stone_wall');
    world.add(mesh);
    const cache = cacheCreate(new Map([['stone_wall', new THREE.Texture()]]));
    previewCatalogMaterialsRebind(world, new Set(['stone_wall']), cache);
    expect(previewCatalogMaterialsRebind(world, new Set(['stone_wall']), cache)).toBe(0);
  });
});
