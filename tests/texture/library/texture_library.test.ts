import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextureLibrary } from '@/texture/library/texture_library.js';
import { TextureBrowserEntry, createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import {
  TEXTURE_LIBRARY_SOURCE_BUILT_IN,
  TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS,
  TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER,
  TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES,
} from '@/texture/library/texture_library_source.js';
import { mockObjectUrlApis } from './utils_object_url_test.js';

/** Short aliases keep the source-order expectations readable. */
const GAME = TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS;
const PROJECT = TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES;
const LOCAL = TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER;

/** Unit tests for the texture library and its named sources. */
describe('TextureLibrary', () => {
  let library: TextureLibrary;

  beforeEach(() => {
    library = new TextureLibrary();
    mockObjectUrlApis('blob:lib');
  });

  afterEach(() => {
    library.clearAllSources();
    vi.restoreAllMocks();
  });

  it('should always include the built-in checker as the first entry', () => {
    expect(library.getEntryCount()).toBe(1);
    expect(library.getSelectedId()).toBe(DEFAULT_CHECKER_TEXTURE_ID);
    expect(library.getEntries()[0]?.id).toBe(DEFAULT_CHECKER_TEXTURE_ID);
    expect(library.getEntries()[0]?.sourceName).toBe(TEXTURE_LIBRARY_SOURCE_BUILT_IN);
  });

  it('should keep checker first and the order of the entries of a source', () => {
    library.replaceSource(LOCAL, [createEntry('b.png', LOCAL), createEntry('a.png', LOCAL)]);
    expect(library.getEntries().map((entry) => entry.id)).toEqual([DEFAULT_CHECKER_TEXTURE_ID, 'b.png', 'a.png']);
  });

  it('should merge game materials, then project textures, then the local folder in any arrival order', () => {
    library.replaceSource(LOCAL, [createEntry('local.png', LOCAL)]);
    library.replaceSource(PROJECT, [createEntry('textures/wall.png', PROJECT)]);
    library.replaceSource(GAME, [createEntry('castle/wall', GAME)]);
    expect(library.getEntries().map((entry) => entry.id)).toEqual([
      DEFAULT_CHECKER_TEXTURE_ID,
      'castle/wall',
      'textures/wall.png',
      'local.png',
    ]);
    expect(library.getEntries().map((entry) => entry.sourceName)).toEqual([
      TEXTURE_LIBRARY_SOURCE_BUILT_IN,
      GAME,
      PROJECT,
      LOCAL,
    ]);
  });

  it('should list a duplicated id once, from the earliest source', () => {
    const projectEntry = createEntry('shared.png', PROJECT);
    library.replaceSource(LOCAL, [createEntry('shared.png', LOCAL)]);
    library.replaceSource(PROJECT, [projectEntry]);
    expect(library.getEntries().filter((entry) => entry.id === 'shared.png')).toEqual([projectEntry]);
    expect(library.getEntryById('shared.png')).toBe(projectEntry);
    library.clearSource(PROJECT);
    expect(library.getEntryById('shared.png')?.sourceName).toBe(LOCAL);
  });

  it('should replace and revoke only the source that changes', () => {
    const gameEntry = createEntry('stone', GAME);
    const oldLocalEntry = createEntry('old.png', LOCAL);
    library.replaceSource(GAME, [gameEntry]);
    library.replaceSource(LOCAL, [oldLocalEntry]);
    library.replaceSource(LOCAL, [createEntry('new.png', LOCAL)]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(oldLocalEntry.previewObjectUrl);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(gameEntry.previewObjectUrl);
    expect(library.getEntries().map((entry) => entry.id)).toEqual([DEFAULT_CHECKER_TEXTURE_ID, 'stone', 'new.png']);
  });

  it('should select by id only when the entry exists', () => {
    library.replaceSource(LOCAL, [createEntry('one.png', LOCAL), createEntry('two.png', LOCAL)]);
    expect(library.selectById('two.png')).toBe(true);
    expect(library.getSelectedEntry().displayName).toBe('two');
    expect(library.selectById('missing.png')).toBe(false);
    expect(library.getSelectedId()).toBe('two.png');
  });

  it('should reset selection to checker when the source of the selected entry is cleared', () => {
    const projectEntry = createEntry('only.png', PROJECT);
    library.replaceSource(PROJECT, [projectEntry]);
    library.selectById('only.png');
    library.clearSource(PROJECT);
    expect(library.getSelectedId()).toBe(DEFAULT_CHECKER_TEXTURE_ID);
    expect(library.getEntryById('only.png')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(projectEntry.previewObjectUrl);
    expect(library.getEntryCount()).toBe(1);
  });
});

/**
 * Creates a test texture entry with a unique object URL; its file name is the
 * last segment of its id.
 *
 * @param relativePath Relative path id.
 * @param sourceName Texture library source the entry belongs to.
 * @returns Browser entry.
 */
function createEntry(relativePath: string, sourceName: string): TextureBrowserEntry {
  const fileName = relativePath.split('/').pop() ?? relativePath;
  return createTextureBrowserEntry(new File(['img'], fileName, { type: 'image/png' }), relativePath, sourceName);
}
