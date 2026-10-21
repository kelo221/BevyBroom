import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PreviewLinkChannel, type PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Preview channel a feature adds to the link. The controller ticks it while
 * connected and tells it when a new game process answered.
 */
export abstract class PreviewLinkFeatureChannel extends PreviewLinkChannel {
  /**
   * Creates a feature channel.
   *
   * @param listener Receives request outcomes.
   */
  protected constructor(listener: PreviewLinkChannelListener) {
    super(listener);
  }

  /**
   * Starts this channel's request when one is due.
   *
   * @param nowMilliseconds Current time.
   * @returns The started request, or null when nothing was due.
   */
  abstract tickIfDue(nowMilliseconds: number): Promise<void> | null;

  /**
   * Forgets everything learned from the previous game process.
   *
   * @param status First status of the new game process.
   */
  abstract gameInstanceAdopt(status: PreviewBridgeStatus): void;
}

/** Creates a feature channel for one preview link. */
export type PreviewLinkFeatureChannelFactory = (
  transport: PreviewLinkTransport,
  listener: PreviewLinkChannelListener,
) => PreviewLinkFeatureChannel;
