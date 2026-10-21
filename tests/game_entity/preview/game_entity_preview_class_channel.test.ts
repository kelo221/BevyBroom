import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameEntityClassProviderPreview } from '@/game_entity/class/game_entity_class_provider_preview.js';
import {
  GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS,
  GameEntityPreviewClassChannel,
} from '@/game_entity/preview/game_entity_preview_class_channel.js';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import type { PreviewLinkChannelListener } from '@/preview/link/preview_link_channel.js';
import { PREVIEW_METHOD, type PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewLinkTransportFake } from '../../preview/link/preview_link_transport_fake.js';
import { testClassListCreate } from '../game_entity_test_classes.js';

/**
 * Creates a listener that records request outcomes.
 *
 * @returns Listener with mock callbacks.
 */
function listenerCreate(): PreviewLinkChannelListener & { failures: string[] } {
  const failures: string[] = [];
  return { failures, onRequestSucceeded: () => {}, onRequestFailed: (message) => failures.push(message) };
}

/**
 * Returns a status of a game in a project.
 *
 * @param projectIdentifier Game project id.
 * @returns Status with the fields the channel reads.
 */
function statusOf(projectIdentifier: string): PreviewBridgeStatus {
  return { project_id: projectIdentifier } as PreviewBridgeStatus;
}

/**
 * The class channel polls the game's classes, hands only changed lists to its
 * provider and starts over when a new game process answers.
 */
describe('GameEntityPreviewClassChannel', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('hands the class list to the provider once per generation', async () => {
    const transport = new PreviewLinkTransportFake();
    transport.placeableClassesReply = testClassListCreate();
    const provider = new GameEntityClassProviderPreview();
    const writes = vi.spyOn(provider, 'listWrite');
    const channel = new GameEntityPreviewClassChannel(transport, listenerCreate(), provider);
    channel.gameInstanceAdopt(statusOf('project-channel'));
    await channel.tickIfDue(0);
    expect(channel.tickIfDue(GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS - 1)).toBeNull();
    await channel.tickIfDue(GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS);
    expect(transport.callsOf(PREVIEW_METHOD.placeableClasses)).toHaveLength(2);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(provider.listRead()).toEqual(testClassListCreate());
    transport.placeableClassesReply = { ...testClassListCreate(), generation: testClassListCreate().generation + 1 };
    await channel.tickIfDue(GAME_ENTITY_CLASS_INTERVAL_MILLISECONDS * 2);
    expect(writes).toHaveBeenCalledTimes(2);
  });

  it('loads the list again for a new game process', async () => {
    const transport = new PreviewLinkTransportFake();
    transport.placeableClassesReply = testClassListCreate();
    const provider = new GameEntityClassProviderPreview();
    const writes = vi.spyOn(provider, 'listWrite');
    const channel = new GameEntityPreviewClassChannel(transport, listenerCreate(), provider);
    await channel.tickIfDue(0);
    channel.gameInstanceAdopt(statusOf('project-channel'));
    await channel.tickIfDue(1);
    expect(writes).toHaveBeenCalledTimes(2);
  });

  it('reports unreadable replies as failures', async () => {
    const transport = new PreviewLinkTransportFake();
    transport.placeableClassesReply = 'not a list';
    const listener = listenerCreate();
    await new GameEntityPreviewClassChannel(transport, listener, new GameEntityClassProviderPreview()).tickIfDue(0);
    expect(listener.failures).toHaveLength(1);
  });

  it('is ticked by every preview link', async () => {
    const transport = new PreviewLinkTransportFake();
    const clock = { now: 1000 };
    const controller = new PreviewLinkController({
      worldGroup: new THREE.Group(),
      transport,
      clock: () => clock.now,
      geometryEncoder: async () => 'Z2xURg==',
      onCatalogLoaded: () => {},
      isEditInProgress: () => false,
      levelNameProvider: () => 'test_level',
    });
    controller.connect();
    await Promise.all(controller.tick());
    await Promise.all(controller.tick());
    expect(transport.callsOf(PREVIEW_METHOD.placeableClasses).length).toBeGreaterThan(0);
  });
});
