import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { InputTexture } from '@/texture/ui/input_texture/input_texture.js';
import {
  PROCEDURAL_TEST_TEXTURE_IDS,
  proceduralTestTextureLibraryInstall,
  proceduralTestTextureLibraryRemove,
} from '../../../procedural/texture/procedural_texture_test_library.js';

/**
 * Returns the list and thumbnail of an input.
 *
 * @param input Texture input.
 * @returns The select element and the thumbnail image.
 */
function partsOf(input: InputTexture): { select: HTMLSelectElement; thumbnail: HTMLImageElement } {
  const select = input.getElement().querySelector('select');
  const thumbnail = input.getElement().querySelector('img');
  if (!select || !thumbnail) throw new Error('the input shows a list and a thumbnail');
  return { select, thumbnail };
}

/** The texture input lists library textures by name and shows a thumbnail. */
describe('InputTexture', () => {
  beforeEach(() => {
    proceduralTestTextureLibraryInstall();
  });

  afterEach(() => {
    proceduralTestTextureLibraryRemove();
    vi.restoreAllMocks();
  });

  it('lists every library texture by name and shows the thumbnail of a shared texture', () => {
    const input = new InputTexture('Surface Texture');
    input.setSharedValues([PROCEDURAL_TEST_TEXTURE_IDS.brick, PROCEDURAL_TEST_TEXTURE_IDS.brick]);
    const { select, thumbnail } = partsOf(input);
    const library = getTextureMapCache().getLibrary();
    const listed = [...select.options].map((option) => option.value);
    expect(listed).toEqual(expect.arrayContaining(library?.getEntries().map((entry) => entry.id) ?? ['missing']));
    expect(select.value).toBe(PROCEDURAL_TEST_TEXTURE_IDS.brick);
    expect(thumbnail.getAttribute('src')).toBe(
      library?.getEntryById(PROCEDURAL_TEST_TEXTURE_IDS.brick)?.previewObjectUrl,
    );
    expect(thumbnail.style.visibility).toBe('visible');
  });

  it('hides the thumbnail for different textures and keeps unknown ids pickable', () => {
    const input = new InputTexture('Surface Texture');
    input.setSharedValues([PROCEDURAL_TEST_TEXTURE_IDS.brick, 'not/in_library']);
    const { select, thumbnail } = partsOf(input);
    expect(thumbnail.style.visibility).toBe('hidden');
    expect([...select.options].map((option) => option.value)).toContain('not/in_library');
  });

  it('hands the picked texture to the commit handler', () => {
    const input = new InputTexture('Surface Texture');
    input.setSharedValues([PROCEDURAL_TEST_TEXTURE_IDS.brick]);
    const picked: string[] = [];
    input.bindCommit((textureId) => picked.push(textureId));
    const { select } = partsOf(input);
    select.value = PROCEDURAL_TEST_TEXTURE_IDS.glass;
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual([PROCEDURAL_TEST_TEXTURE_IDS.glass]);
  });
});
