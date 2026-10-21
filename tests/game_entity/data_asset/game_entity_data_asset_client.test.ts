import { afterEach, describe, expect, it } from 'vitest';
import { GameEntityDataAssetChannel } from '@/game_entity/data_asset/game_entity_data_asset_channel.js';
import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { PREVIEW_METHOD } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewLinkTransportFake } from '../../preview/link/preview_link_transport_fake.js';
import { testDataAssetGameCreate, testDoorStatsAssetType } from './game_entity_data_asset_test_support.js';

/**
 * The data asset client reads and writes files through the bridge methods and
 * sanitizes what the game sends; the preview channel makes the newest link's
 * client the active one.
 */
describe('GameEntityDataAssetClient', () => {
  afterEach(() => {
    GameEntityDataAssetClient.activeAdopt(null);
  });

  it('reads the type and overrides of a file', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const path = assetType.paths[0] ?? '';
    const reply = await client.read(path);
    expect(reply.type_path).toBe(assetType.type_path);
    expect(reply.values).toEqual(transport.dataAssetFiles.get(path)?.values);
    expect(transport.callsOf(PREVIEW_METHOD.dataAssetRead)).toEqual([
      { method: PREVIEW_METHOD.dataAssetRead, params: { path } },
    ]);
  });

  it('writes overrides and returns the generation that marks the write as done', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const values = { [assetType.fields?.[1]?.path ?? 'value']: 4 };
    const generation = await client.write('data/new.door.ron', assetType.type_path, values);
    expect(generation).toBe(transport.dataAssetGeneration);
    expect(transport.dataAssetFiles.get('data/new.door.ron')).toEqual({ type_path: assetType.type_path, values });
  });

  it('drops values that cannot be field values and rejects unreadable replies', async () => {
    const transport = new PreviewLinkTransportFake();
    transport.dataAssetFiles.set('odd.door.ron', { type_path: 'game::Odd', values: { kept: 2, dropped: { a: [] } } });
    const client = new GameEntityDataAssetClient(transport);
    expect((await client.read('odd.door.ron')).values).toEqual({ kept: 2 });
    transport.dataAssetFiles.set('broken.door.ron', { type_path: 7 as unknown as string, values: {} });
    await expect(client.read('broken.door.ron')).rejects.toThrow();
  });

  it('is activated by the preview channel of the newest link', () => {
    expect(GameEntityDataAssetClient.activeRead()).toBeNull();
    const channel = new GameEntityDataAssetChannel(new PreviewLinkTransportFake(), {
      onRequestSucceeded: () => {},
      onRequestFailed: () => {},
    });
    expect(GameEntityDataAssetClient.activeRead()).not.toBeNull();
    expect(channel.tickIfDue(Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});
