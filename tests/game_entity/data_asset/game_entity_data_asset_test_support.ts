import type { GameEntityAssetType } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import { PreviewLinkTransportFake } from '../../preview/link/preview_link_transport_fake.js';
import { testClassListCreate } from '../game_entity_test_classes.js';

/**
 * Returns the editable door stats asset type of the test class list.
 *
 * @returns Asset type with fields and files.
 */
export function testDoorStatsAssetType(): GameEntityAssetType {
  const assetType = testClassListCreate().asset_types[0];
  if (!assetType) {
    throw new Error('the test class list has an asset type');
  }
  return assetType;
}

/**
 * Creates an in-memory game holding one door stats file per existing path of
 * the test asset type, each overriding the first field, and a client on it.
 *
 * @returns Fake transport and client.
 */
export function testDataAssetGameCreate(): { transport: PreviewLinkTransportFake; client: GameEntityDataAssetClient } {
  const transport = new PreviewLinkTransportFake();
  const assetType = testDoorStatsAssetType();
  const firstField = assetType.fields?.[0];
  assetType.paths.forEach((path, index) => {
    const values = firstField ? { [firstField.path]: Number(firstField.default) + index + 1 } : {};
    transport.dataAssetFiles.set(path, { type_path: assetType.type_path, values });
  });
  return { transport, client: new GameEntityDataAssetClient(transport) };
}
