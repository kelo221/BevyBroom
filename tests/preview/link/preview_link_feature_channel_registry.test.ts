import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import {
  PreviewLinkFeatureChannel,
  type PreviewLinkFeatureChannelFactory,
} from '@/preview/link/preview_link_feature_channel.js';
import { PreviewLinkFeatureChannelRegistry } from '@/preview/link/preview_link_feature_channel_registry.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import type { PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PREVIEW_STATUS_INTERVAL_MILLISECONDS } from '@/preview/link/preview_link_status_channel.js';
import { PreviewLinkTransportFake } from './preview_link_transport_fake.js';

/** Method name the test channel calls on the game. */
const TEST_CHANNEL_METHOD = 'test.feature_ping';

/** Feature channel that pings the game on every tick and counts restarts. */
class TestPingChannel extends PreviewLinkFeatureChannel {
  private readonly transport: PreviewLinkTransport;
  adoptCount = 0;

  /**
   * Creates the channel.
   *
   * @param transport Bridge transport.
   * @param listener Request outcome listener.
   */
  constructor(transport: PreviewLinkTransport, listener: PreviewLinkChannelListener) {
    super(listener);
    this.transport = transport;
  }

  /**
   * Pings the game.
   *
   * @returns The started request.
   */
  tickIfDue(): Promise<void> | null {
    return this.requestRun(async () => {
      await this.transport.call(TEST_CHANNEL_METHOD, null, 1000);
    });
  }

  /** Counts game restarts. */
  gameInstanceAdopt(): void {
    this.adoptCount += 1;
  }
}

/**
 * Creates a connected controller over a fake game.
 *
 * @param transport Fake transport.
 * @param clock Manual clock.
 * @returns Controller.
 */
function controllerCreate(transport: PreviewLinkTransportFake, clock: { now: number }): PreviewLinkController {
  const controller = new PreviewLinkController({
    worldGroup: new THREE.Group(),
    transport,
    geometryEncoder: async () => 'Z2xURg==',
    onCatalogLoaded: () => {},
    clock: () => clock.now,
    isEditInProgress: () => false,
    levelNameProvider: () => 'test_level',
  });
  controller.connect();
  return controller;
}

/** Registered feature channels are created, ticked and reset by every link. */
describe('PreviewLinkFeatureChannelRegistry', () => {
  const channels: TestPingChannel[] = [];
  const factory: PreviewLinkFeatureChannelFactory = (transport, listener) => {
    const channel = new TestPingChannel(transport, listener);
    channels.push(channel);
    return channel;
  };

  afterEach(() => {
    PreviewLinkFeatureChannelRegistry.unregister(factory);
    channels.length = 0;
  });

  it('ticks a registered channel once the link is connected', async () => {
    PreviewLinkFeatureChannelRegistry.register(factory);
    const transport = new PreviewLinkTransportFake();
    const clock = { now: 1000 };
    const controller = controllerCreate(transport, clock);
    await Promise.all(controller.tick());
    expect(transport.callsOf(TEST_CHANNEL_METHOD)).toHaveLength(0);
    await Promise.all(controller.tick());
    expect(transport.callsOf(TEST_CHANNEL_METHOD)).toHaveLength(1);
  });

  it('tells a registered channel when a new game process answers', async () => {
    PreviewLinkFeatureChannelRegistry.register(factory);
    const transport = new PreviewLinkTransportFake();
    const clock = { now: 1000 };
    const controller = controllerCreate(transport, clock);
    await Promise.all(controller.tick());
    const adoptsAfterFirstGame = channels[0]?.adoptCount ?? 0;
    transport.instanceIdentifier = 'game-instance-b';
    clock.now += PREVIEW_STATUS_INTERVAL_MILLISECONDS;
    await Promise.all(controller.tick());
    expect(channels[0]?.adoptCount).toBe(adoptsAfterFirstGame + 1);
  });
});
