import { describe, expect, it } from 'vitest';
import {
  gameEntityDataAssetClassCreate,
  gameEntityDataAssetPathMatches,
  gameEntityDataAssetPathSuggest,
} from '@/game_entity/data_asset/game_entity_data_asset_class.js';
import { testDoorStatsAssetType } from './game_entity_data_asset_test_support.js';

/**
 * Data asset types are shown as classes, new files get a free path next to the
 * existing ones, and paths are matched against the type's extensions.
 */
describe('game entity data asset class helpers', () => {
  it('describes an asset type as a class with its fields', () => {
    const assetType = testDoorStatsAssetType();
    const gameClass = gameEntityDataAssetClassCreate(assetType);
    expect(gameClass.type_path).toBe(assetType.type_path);
    expect(gameClass.label).toBe(assetType.label);
    expect(gameClass.fields).toEqual(assetType.fields);
  });

  it('suggests a path that is not taken, next to the existing files', () => {
    const assetType = testDoorStatsAssetType();
    const firstPath = assetType.paths[0] ?? '';
    const directory = firstPath.slice(0, firstPath.lastIndexOf('/'));
    const suggested = gameEntityDataAssetPathSuggest(assetType);
    expect(suggested.startsWith(`${directory}/`)).toBe(true);
    expect(gameEntityDataAssetPathMatches(assetType, suggested)).toBe(true);
    const again = gameEntityDataAssetPathSuggest({ ...assetType, paths: [...assetType.paths, suggested] });
    expect(again).not.toBe(suggested);
    expect(gameEntityDataAssetPathMatches(assetType, again)).toBe(true);
  });

  it('places suggestions in a data folder when the type has no files', () => {
    const assetType = { ...testDoorStatsAssetType(), paths: [] };
    expect(gameEntityDataAssetPathSuggest(assetType).startsWith('data/')).toBe(true);
  });

  it('matches only paths ending with a type extension', () => {
    const assetType = testDoorStatsAssetType();
    const extension = assetType.extensions[0] ?? '';
    expect(gameEntityDataAssetPathMatches(assetType, `stats/heavy.${extension}`)).toBe(true);
    expect(gameEntityDataAssetPathMatches(assetType, `.${extension}`)).toBe(false);
    expect(gameEntityDataAssetPathMatches(assetType, 'stats/heavy.png')).toBe(false);
  });
});
