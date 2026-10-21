import { describe, expect, it } from 'vitest';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { GameEntityDataAssetSession } from '@/game_entity/data_asset/game_entity_data_asset_session.js';
import { testDataAssetGameCreate, testDoorStatsAssetType } from './game_entity_data_asset_test_support.js';

/**
 * A data asset session reads a file of the expected type, creates new files
 * with the type's defaults and writes every edit to the game.
 */
describe('GameEntityDataAssetSession', () => {
  it('opens a file and exposes its overrides as a component map', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const path = assetType.paths[0] ?? '';
    const session = await GameEntityDataAssetSession.open(assetType, path, client);
    expect(session.componentsRead()).toEqual({ [assetType.type_path]: transport.dataAssetFiles.get(path)?.values });
  });

  it('refuses a file that holds another type', async () => {
    const { transport, client } = testDataAssetGameCreate();
    transport.dataAssetFiles.set('other.door.ron', { type_path: 'other_game::Thing', values: {} });
    await expect(GameEntityDataAssetSession.open(testDoorStatsAssetType(), 'other.door.ron', client)).rejects.toThrow(
      'other_game::Thing',
    );
  });

  it('creates files only with a type extension and starts them empty', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    await expect(GameEntityDataAssetSession.create(assetType, 'data/new.png', client)).rejects.toThrow();
    const path = `data/new.${assetType.extensions[0] ?? ''}`;
    const session = await GameEntityDataAssetSession.create(assetType, path, client);
    expect(session.componentsRead()).toEqual({ [assetType.type_path]: {} });
    expect(transport.dataAssetFiles.get(path)).toEqual({ type_path: assetType.type_path, values: {} });
  });

  it('writes edits and keeps the written overrides', async () => {
    const { transport, client } = testDataAssetGameCreate();
    const assetType = testDoorStatsAssetType();
    const path = assetType.paths[0] ?? '';
    const field = assetType.fields?.[1];
    if (!field) {
      throw new Error('the asset type has a second field');
    }
    const session = await GameEntityDataAssetSession.open(assetType, path, client);
    const value = Number(field.default) + 5;
    await session.valuesEdit((components) =>
      GameEntityComponentsEdit.fieldSet(components, assetType.type_path, field, value),
    );
    expect(session.componentsRead()[assetType.type_path]?.[field.path]).toBe(value);
    expect(transport.dataAssetFiles.get(path)?.values).toEqual(session.componentsRead()[assetType.type_path]);
  });
});
