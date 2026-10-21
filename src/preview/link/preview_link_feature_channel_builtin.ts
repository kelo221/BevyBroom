import { GameEntityDataAssetChannel } from '@/game_entity/data_asset/game_entity_data_asset_channel.js';
import { GameEntityPreviewClassChannel } from '@/game_entity/preview/game_entity_preview_class_channel.js';
import type { PreviewLinkFeatureChannelFactory } from '@/preview/link/preview_link_feature_channel.js';

/**
 * Returns the feature channels the editor ships with.
 *
 * @returns Channel factories in tick order.
 */
export function previewLinkFeatureChannelsBuiltin(): readonly PreviewLinkFeatureChannelFactory[] {
  return [
    (transport, listener) => new GameEntityPreviewClassChannel(transport, listener),
    (transport, listener) => new GameEntityDataAssetChannel(transport, listener),
  ];
}
