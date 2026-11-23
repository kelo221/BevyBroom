import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { previewCatalogMaterialsRebind } from '@/preview/catalog/preview_catalog_material_rebind.js';
import { materialIdentityWrite } from '@/materials/identity/material_identity.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { createContentViewLitMaterial } from '@/materials/factory_content_view_lit_material.js';
import { MaterialColorNeutral } from '@/materials/material_color_neutral.js';

/**
 * Creates a cache stand-in that resolves every id to its own texture and
 * opacity.
 *
 * @param texturesByIdentifier Textures returned per id.
 * @param opacitiesByIdentifier Opacity of the see-through ids.
 * @returns Object usable where a texture map cache is expected.
 */
function cacheCreate(
  texturesByIdentifier: Map<string, THREE.Texture>,
  opacitiesByIdentifier: Map<string, number> = new Map(),
): TextureMapCache {
  return {
    resolve: (identifier: string) => texturesByIdentifier.get(identifier) ?? null,
    blendOpacityOf: (identifier: string) => opacitiesByIdentifier.get(identifier) ?? null,
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

  it('makes materials of a blended game material see-through once, and opaque again when it stops blending', () => {
    const texture = new THREE.Texture();
    const material = createContentViewLitMaterial(MaterialColorNeutral.white, texture);
    materialIdentityWrite(material, 'glass_pane');
    const world = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const glassOpacity = 0.3;
    const glassCache = cacheCreate(new Map([['glass_pane', texture]]), new Map([['glass_pane', glassOpacity]]));
    expect(previewCatalogMaterialsRebind(world, new Set(['glass_pane']), glassCache)).toBe(1);
    expect(material.transparent).toBe(true);
    expect(material.translucencyRead()).toBeCloseTo(glassOpacity);
    expect(previewCatalogMaterialsRebind(world, new Set(['glass_pane']), glassCache)).toBe(0);
    const opaqueCache = cacheCreate(new Map([['glass_pane', texture]]));
    expect(previewCatalogMaterialsRebind(world, new Set(['glass_pane']), opaqueCache)).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.translucencyRead()).toBeNull();
  });
});
