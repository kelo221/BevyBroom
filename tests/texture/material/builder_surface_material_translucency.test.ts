import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialColorNeutral } from '@/materials/material_color_neutral.js';
import { createSurfaceMaterial } from '@/texture/material/builder_surface_material.js';
import type { TextureMapCache } from '@/texture/library/texture_map_cache.js';
import {
  PROCEDURAL_TEST_GLASS_OPACITY,
  PROCEDURAL_TEST_TEXTURE_IDS,
  proceduralTestTextureLibraryInstall,
  proceduralTestTextureLibraryRemove,
} from '../../procedural/texture/procedural_texture_test_library.js';

/** Surfaces of a see-through library texture such as glass are see-through. */
describe('createSurfaceMaterial translucency', () => {
  let cache: TextureMapCache;

  beforeEach(() => {
    cache = proceduralTestTextureLibraryInstall();
  });

  afterEach(() => {
    proceduralTestTextureLibraryRemove();
    vi.restoreAllMocks();
  });

  it('makes a glass texture see-through with its opacity and keeps other textures opaque', () => {
    const glass = createSurfaceMaterial(MaterialColorNeutral.white, PROCEDURAL_TEST_TEXTURE_IDS.glass, cache);
    const brick = createSurfaceMaterial(MaterialColorNeutral.white, PROCEDURAL_TEST_TEXTURE_IDS.brick, cache);
    expect(glass.transparent).toBe(true);
    expect(glass.translucencyRead()).toBeCloseTo(PROCEDURAL_TEST_GLASS_OPACITY);
    expect(brick.transparent).toBe(false);
    expect(cache.blendOpacityOf('not/in_library')).toBeNull();
    glass.dispose();
    brick.dispose();
  });
});
