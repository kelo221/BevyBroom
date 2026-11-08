import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { TextureLibrary } from '@/texture/library/texture_library.js';
import { TextureMapCache, setTextureMapCacheForTests } from '@/texture/library/texture_map_cache.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';
import {
  TEXTURE_LIBRARY_SOURCE_BUILT_IN,
  TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS,
  TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES,
} from '@/texture/library/texture_library_source.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { mockObjectUrlApis } from '../../texture/library/utils_object_url_test.js';

/** Unit tests for the texture_browser_entries tool. */
describe('EditorApiTextureBrowser', () => {
  let library: TextureLibrary;

  beforeEach(() => {
    mockObjectUrlApis('blob:api');
    library = new TextureLibrary();
    const cache = new TextureMapCache();
    cache.setLibrary(library);
    setTextureMapCacheForTests(cache);
  });

  afterEach(() => {
    library.clearAllSources();
    setTextureMapCacheForTests(null);
    vi.restoreAllMocks();
  });

  it('is listed with a description naming project textures', () => {
    expect(findMcpTool('texture_browser_entries')?.description).toContain('Project textures');
  });

  it('returns id, display name and source of every listed texture in browser order', () => {
    const projectPath = 'textures/walls/brick.png';
    library.replaceSource(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES, [
      createTextureBrowserEntry(new File(['p'], 'brick.png'), projectPath, TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES),
    ]);
    library.replaceSource(TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS, [
      createTextureBrowserEntry(new File(['g'], 'stone.png'), 'castle/stone', TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS),
    ]);
    const result = new EditorApi(editorApiTestHostCreate().host).invokeTool('texture_browser_entries');
    expect(result.ok).toBe(true);
    expect((result.data as { entries: unknown[] }).entries).toEqual([
      { id: DEFAULT_CHECKER_TEXTURE_ID, displayName: expect.any(String), source: TEXTURE_LIBRARY_SOURCE_BUILT_IN },
      { id: 'castle/stone', displayName: 'stone', source: TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS },
      { id: projectPath, displayName: 'brick', source: TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES },
    ]);
  });

  it('fails while no texture library is bound', () => {
    setTextureMapCacheForTests(new TextureMapCache());
    const result = new EditorApi(editorApiTestHostCreate().host).invokeTool('texture_browser_entries');
    expect(result.ok).toBe(false);
  });
});
