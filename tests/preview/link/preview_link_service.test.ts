import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { PREVIEW_DEFAULT_ENDPOINT } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Creates a service around an empty world with inert hooks.
 *
 * @returns New disconnected service.
 */
function serviceCreate(): PreviewLinkService {
  return new PreviewLinkService(new THREE.Group(), {
    onCatalogLoaded: () => {},
    levelNameProvider: () => 'service_test_level',
  });
}

describe('PreviewLinkService', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no game in tests'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('remembers the endpoint and restores the default for a blank one', () => {
    const service = serviceCreate();
    expect(service.endpointRead()).toBe(PREVIEW_DEFAULT_ENDPOINT);
    service.endpointWrite('  http://127.0.0.1:16000  ');
    expect(serviceCreate().endpointRead()).toBe('http://127.0.0.1:16000');
    service.endpointWrite('   ');
    expect(service.endpointRead()).toBe(PREVIEW_DEFAULT_ENDPOINT);
  });

  it('keeps its own endpoint when another editor sharing the storage writes a different one', () => {
    const first = serviceCreate();
    const second = serviceCreate();
    first.endpointWrite('http://127.0.0.1:16001');
    second.endpointWrite('http://127.0.0.1:16002');
    expect(first.endpointRead()).toBe('http://127.0.0.1:16001');
    expect(second.endpointRead()).toBe('http://127.0.0.1:16002');
    expect(serviceCreate().endpointRead()).toBe('http://127.0.0.1:16002');
  });

  it('connects a fresh controller, notifies listeners and disconnects it again', () => {
    const service = serviceCreate();
    const listener = vi.fn();
    service.changeListenerAdd(listener);
    expect(service.controllerRead()).toBeNull();
    service.connect();
    const controller = service.controllerRead();
    expect(controller?.connectionStateRead()).toBe('connecting');
    expect(listener).toHaveBeenCalled();
    service.disconnect();
    expect(controller?.connectionStateRead()).toBe('disconnected');
  });

  it('replaces the controller on reconnect so a new endpoint takes effect', () => {
    const service = serviceCreate();
    service.connect();
    const firstController = service.controllerRead();
    service.connect();
    expect(service.controllerRead()).not.toBe(firstController);
    expect(firstController?.connectionStateRead()).toBe('disconnected');
    service.disconnect();
  });

  it('stops notifying a listener once it is removed', () => {
    const service = serviceCreate();
    const listener = vi.fn();
    const listenerRemove = service.changeListenerAdd(listener);
    listenerRemove();
    service.connect();
    service.disconnect();
    expect(listener).not.toHaveBeenCalled();
  });
});
