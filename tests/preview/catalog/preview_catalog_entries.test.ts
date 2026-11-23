import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PreviewCatalogEntryLoader } from '@/preview/catalog/preview_catalog_entries.js';
import { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import {
  PREVIEW_METHOD,
  type PreviewAssetReply,
  type PreviewMaterialCatalog,
} from '@/preview/protocol/preview_protocol_types.js';
import { mockObjectUrlApis } from '../../texture/library/utils_object_url_test.js';

/** Asset folder of the sample game. */
const PREVIEW_CATALOG_TEST_ASSET_ROOT = join(process.cwd(), 'bevy/assets');

/** Answers catalog and asset reads from the sample game's asset folder. */
class PreviewLinkTransportSampleGame extends PreviewLinkTransport {
  /**
   * Answers one request.
   *
   * @param method Requested method.
   * @param params Request parameters.
   * @returns The catalog reply or the asset file.
   */
  async call<Result>(method: string, params: unknown): Promise<Result> {
    if (method === PREVIEW_METHOD.readAsset) {
      const path = (params as { path: string }).path;
      const reply: PreviewAssetReply = {
        path,
        base64: readFileSync(join(PREVIEW_CATALOG_TEST_ASSET_ROOT, path)).toString('base64'),
      };
      return reply as Result;
    }
    const catalog = JSON.parse(readFileSync(join(PREVIEW_CATALOG_TEST_ASSET_ROOT, 'broom/materials.json'), 'utf8'));
    return { catalog, error: null, generation: 1 } as Result;
  }
}

/**
 * Reads the sample game's material catalog file.
 *
 * @returns The catalog.
 */
function sampleCatalogRead(): PreviewMaterialCatalog {
  return JSON.parse(readFileSync(join(PREVIEW_CATALOG_TEST_ASSET_ROOT, 'broom/materials.json'), 'utf8'));
}

/**
 * Game materials become texture browser entries, see-through ones marked as
 * such.
 */
describe('PreviewCatalogEntryLoader', () => {
  beforeEach(() => {
    mockObjectUrlApis('blob:catalog');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks every blended game material see-through with its base color alpha, and only those', async () => {
    const catalog = sampleCatalogRead();
    const loaded = await PreviewCatalogEntryLoader.load(new PreviewLinkTransportSampleGame());
    expect(loaded.entries.map((entry) => entry.id)).toEqual(catalog.materials.map((material) => material.id));
    for (const material of catalog.materials) {
      const entry = loaded.entries.find((candidate) => candidate.id === material.id);
      const expected = material.alpha === 'blend' ? material.base_color[3] : undefined;
      expect(entry?.blendOpacity).toBe(expected);
    }
  });

  it('ships glass materials in the sample game that are see-through', () => {
    const glass = sampleCatalogRead().materials.filter((material) => material.id.startsWith('glass/'));
    expect(glass.length).toBeGreaterThan(0);
    for (const material of glass) {
      expect(material.alpha).toBe('blend');
      expect(PreviewCatalogEntryLoader.opacityOf(material)).toBeLessThan(1);
    }
  });
});
