import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { PreviewLinkController } from '@/preview/link/preview_link_controller.js';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { PreviewLinkTransportFake } from '../../preview/link/preview_link_transport_fake.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/**
 * A preview service that records connects and serves a controller wired to a
 * fake game.
 */
class PreviewLinkServiceRecording extends PreviewLinkService {
  connectCount = 0;
  servedController: PreviewLinkController | null = null;

  /** Records the connect instead of opening a network link. */
  override connect(): void {
    this.connectCount += 1;
  }

  /**
   * Returns the controller the test assigned.
   *
   * @returns Assigned controller, or null.
   */
  override controllerRead(): PreviewLinkController | null {
    return this.servedController;
  }
}

/**
 * Builds a recording preview service over an empty world.
 *
 * @returns The service.
 */
function previewServiceCreate(): PreviewLinkServiceRecording {
  return new PreviewLinkServiceRecording(new THREE.Group(), {
    onCatalogLoaded: () => undefined,
    levelNameProvider: () => 'preview_tool_level',
  });
}

/**
 * Builds a connected controller talking to a fake game.
 *
 * @returns The controller.
 */
function fakeGameControllerCreate(): PreviewLinkController {
  const controller = new PreviewLinkController({
    worldGroup: new THREE.Group(),
    transport: new PreviewLinkTransportFake(),
    geometryEncoder: async () => 'Z2xURg==',
    onCatalogLoaded: () => undefined,
    clock: () => 1000,
    isEditInProgress: () => false,
    levelNameProvider: () => 'preview_tool_level',
  });
  controller.connect();
  return controller;
}

/** Unit tests for the preview_connect and preview_status MCP tools. */
describe('EditorApiPreview', () => {
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it('remembers the given endpoint and connects to it', () => {
    const service = previewServiceCreate();
    const api = new EditorApi(editorApiTestHostCreate({ previewLinkServiceEnsure: () => service }).host);
    const endpoint = 'http://127.0.0.1:15999';
    const result = api.invokeTool('preview_connect', { endpoint });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ endpoint: service.endpointRead() });
    expect(service.endpointRead()).toBe(endpoint);
    expect(service.connectCount).toBe(1);
  });

  it('reports a disconnected link before the first connect', () => {
    const service = previewServiceCreate();
    const api = new EditorApi(editorApiTestHostCreate({ previewLinkServiceEnsure: () => service }).host);
    expect(api.invokeTool('preview_status').data).toEqual({
      connection: 'disconnected',
      revisions: null,
      game: null,
      lastError: '',
    });
  });

  it('reports what the controller of the current link knows', () => {
    const service = previewServiceCreate();
    const controller = fakeGameControllerCreate();
    service.servedController = controller;
    const api = new EditorApi(editorApiTestHostCreate({ previewLinkServiceEnsure: () => service }).host);
    expect(api.invokeTool('preview_status').data).toEqual({
      connection: controller.connectionStateRead(),
      revisions: controller.revisionsRead(),
      game: controller.gameStatusRead(),
      lastError: controller.lastErrorRead(),
    });
  });

  it('fails to connect when the editor has no game preview', () => {
    const api = new EditorApi(editorApiTestHostCreate().host);
    expect(api.invokeTool('preview_connect', {}).ok).toBe(false);
  });
});
