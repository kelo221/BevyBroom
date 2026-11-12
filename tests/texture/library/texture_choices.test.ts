import { afterEach, describe, expect, it } from 'vitest';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { TextureLibrary } from '@/texture/library/texture_library.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER } from '@/texture/library/texture_library_source.js';
import { textureChoicesList } from '@/texture/library/texture_choices.js';

/** Texture the test library holds. */
const LIBRARY_TEXTURE_ID = 'walls/brick.png';

/**
 * Installs a library holding one texture besides its built-in entries.
 *
 * @returns Installed library.
 */
function libraryInstall(): TextureLibrary {
  const library = new TextureLibrary();
  const file = new File(['img'], 'brick.png', { type: 'image/png' });
  library.replaceSource(TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER, [
    createTextureBrowserEntry(file, LIBRARY_TEXTURE_ID, TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER),
  ]);
  getTextureMapCache().setLibrary(library);
  return library;
}

describe('texture choices', () => {
  afterEach(() => getTextureMapCache().setLibrary(null));

  it('lists library textures, then stored ids the library lacks, once each and without blanks', () => {
    const libraryIds = libraryInstall()
      .getEntries()
      .map((entry) => entry.id);
    const storedId = 'trim/not_listed.png';
    const choices = textureChoicesList([storedId, LIBRARY_TEXTURE_ID, '', storedId]);
    expect(choices.map((choice) => choice.value)).toEqual([...libraryIds, storedId]);
    expect(choices.find((choice) => choice.value === LIBRARY_TEXTURE_ID)?.label).toBe('brick');
    expect(choices.at(-1)?.label).toBe(storedId);
  });

  it('lists only stored ids when no library is loaded', () => {
    expect(textureChoicesList(['a.png']).map((choice) => choice.value)).toEqual(['a.png']);
    expect(textureChoicesList()).toEqual([]);
  });
});
