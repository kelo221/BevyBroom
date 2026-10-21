import { GameEntityDataAssetClient } from '@/game_entity/data_asset/game_entity_data_asset_client.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import { PreviewLinkFeatureChannel } from '@/preview/link/preview_link_feature_channel.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Preview channel that makes its link's data asset client the active one. It
 * sends nothing by itself; data asset requests are made on demand.
 */
export class GameEntityDataAssetChannel extends PreviewLinkFeatureChannel {
  /**
   * Creates the channel and activates a client on its transport.
   *
   * @param transport Bridge transport.
   * @param listener Receives request outcomes.
   */
  constructor(transport: PreviewLinkTransport, listener: PreviewLinkChannelListener) {
    super(listener);
    GameEntityDataAssetClient.activeAdopt(new GameEntityDataAssetClient(transport));
  }

  /**
   * Never starts a request.
   *
   * @param _nowMilliseconds Current time.
   * @returns Always null.
   */
  tickIfDue(_nowMilliseconds: number): Promise<void> | null {
    return null;
  }

  /**
   * Keeps nothing per game process.
   *
   * @param _status First status of the new game process.
   */
  gameInstanceAdopt(_status: PreviewBridgeStatus): void {}
}
