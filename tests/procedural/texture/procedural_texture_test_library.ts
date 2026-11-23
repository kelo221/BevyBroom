import { createTextureBrowserEntry, type TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { TextureLibrary } from '@/texture/library/texture_library.js';
import { TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS } from '@/texture/library/texture_library_source.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import { mockObjectUrlApis } from '../../texture/library/utils_object_url_test.js';

/** Ids of the textures in the test library. */
export const PROCEDURAL_TEST_TEXTURE_IDS = { brick: 'wall/brick', glass: 'glass/test_pane' } as const;

/** Opacity of the see-through texture in the test library. */
export const PROCEDURAL_TEST_GLASS_OPACITY = 0.25;

/**
 * Creates one library entry.
 *
 * @param textureId Texture id.
 * @returns Entry of the game material source.
 */
function entryCreate(textureId: string): TextureBrowserEntry {
  const file = new File(['x'], `${textureId.replaceAll('/', '_')}.png`, { type: 'image/png' });
  return createTextureBrowserEntry(file, textureId, TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS);
}

/**
 * Installs a texture map cache whose library holds an opaque texture and a
 * see-through glass texture.
 *
 * @returns The installed cache.
 */
export function proceduralTestTextureLibraryInstall(): TextureMapCache {
  mockObjectUrlApis('blob:procedural-texture');
  const glass = entryCreate(PROCEDURAL_TEST_TEXTURE_IDS.glass);
  glass.blendOpacity = PROCEDURAL_TEST_GLASS_OPACITY;
  const library = new TextureLibrary();
  library.replaceSource(TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS, [entryCreate(PROCEDURAL_TEST_TEXTURE_IDS.brick), glass]);
  const cache = new TextureMapCache();
  cache.setLibrary(library);
  setTextureMapCacheForTests(cache);
  return cache;
}

/** Removes the cache installed by {@link proceduralTestTextureLibraryInstall}. */
export function proceduralTestTextureLibraryRemove(): void {
  setTextureMapCacheForTests(null);
}
