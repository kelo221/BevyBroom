import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PREVIEW_CATALOG_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_catalog_channel.js';
import type { PreviewCatalogEntries } from '@/preview/catalog/preview_catalog_entries.js';
import { PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewLinkTransportFake } from './preview_link_transport_fake.js';

/**
 * Builds a fake catalog reply with one textured and one plain material.
 *
 * @param generation Catalog generation.
 * @param textureGeneration Texture reload counter.
 * @returns Catalog reply.
 */
function catalogReplyCreate(generation: number, textureGeneration: number): unknown {
  return {
    catalog: {
      catalog_version: 1,
      materials: [
        { id: 'stone/wall', label: 'Wall', base_color: [1, 1, 1, 1], base_color_texture: 'textures/wall.png' },
        { id: 'paint/red', label: 'Red', base_color: [1, 0, 0, 1], base_color_texture: null },
      ],
    },
    error: null,
    generation,
    texture_generation: textureGeneration,
  };
}

/**
 * The editor follows the game material catalog and keeps game maps out of
 * published geometry.
 */
describe('preview catalog channel', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:${(blob as File).name}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads catalog materials as entries and reloads only when a counter changes', async () => {
    const transport = new PreviewLinkTransportFake();
    transport.catalogReply = catalogReplyCreate(1, 0);
    const loaded: PreviewCatalogEntries[] = [];
    const resolvedByGame: boolean[] = [];
    const clock = { now: 0 };
    const controller = new PreviewLinkController({
      worldGroup: new THREE.Group(),
      transport,
      geometryEncoder: async (isGameMaterial) => {
        resolvedByGame.push(isGameMaterial('stone/wall'), isGameMaterial('editor/only'));
        return 'Z2xURg==';
      },
      onCatalogLoaded: (catalog) => loaded.push(catalog),
      clock: () => clock.now,
      isEditInProgress: () => false,
      levelNameProvider: () => 'level',
    });
    controller.connect();
    const tick = async (advance: number): Promise<void> => {
      clock.now += advance;
      await Promise.all(controller.tick());
    };
    await tick(0);
    await tick(10);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.entries.map((entry) => entry.id)).toEqual(['stone/wall', 'paint/red']);
    expect(loaded[0]?.entries[0]?.displayName).toBe('Wall');
    expect(transport.callsOf(PREVIEW_METHOD.readAsset)).toHaveLength(1);
    await tick(PREVIEW_CATALOG_INTERVAL_MILLISECONDS);
    expect(loaded).toHaveLength(1);
    transport.catalogReply = catalogReplyCreate(1, 1);
    await tick(PREVIEW_CATALOG_INTERVAL_MILLISECONDS);
    expect(loaded).toHaveLength(2);
    await tick(PREVIEW_CATALOG_INTERVAL_MILLISECONDS);
    expect(resolvedByGame.slice(0, 2)).toEqual([true, false]);
  });
});
