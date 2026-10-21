import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import type {
  PreviewLinkFeatureChannel,
  PreviewLinkFeatureChannelFactory,
} from '@/preview/link/preview_link_feature_channel.js';
import { previewLinkFeatureChannelsBuiltin } from '@/preview/link/preview_link_feature_channel_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/**
 * Lists the feature channels every preview link creates: the built-in ones
 * followed by channels features register. Register before the link is created.
 */
export class PreviewLinkFeatureChannelRegistry {
  private static readonly factories = new RegistryExtensible<PreviewLinkFeatureChannelFactory>(
    previewLinkFeatureChannelsBuiltin,
  );

  /**
   * Adds a channel factory after the built-in ones.
   *
   * @param factory Channel factory.
   */
  static register(factory: PreviewLinkFeatureChannelFactory): void {
    PreviewLinkFeatureChannelRegistry.factories.register(factory);
  }

  /**
   * Removes a channel factory added with {@link register}.
   *
   * @param factory Channel factory.
   */
  static unregister(factory: PreviewLinkFeatureChannelFactory): void {
    PreviewLinkFeatureChannelRegistry.factories.unregister(factory);
  }

  /**
   * Creates one instance of every registered channel for a link.
   *
   * @param transport Bridge transport of the link.
   * @param listener Receives request outcomes.
   * @returns Channels in registration order.
   */
  static channelsCreate(
    transport: PreviewLinkTransport,
    listener: PreviewLinkChannelListener,
  ): PreviewLinkFeatureChannel[] {
    return PreviewLinkFeatureChannelRegistry.factories.list().map((factory) => factory(transport, listener));
  }
}
