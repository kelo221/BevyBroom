import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { PanelGamePreview } from '@/preview/ui/panel_game_preview.js';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';

/**
 * Finds a panel button by its visible text.
 *
 * @param root Element to search.
 * @param text Button text.
 * @returns The button.
 */
function buttonFind(root: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) {
    throw new Error(`Button "${text}" not found`);
  }
  return button;
}

describe('PanelGamePreview', () => {
  let service: PreviewLinkService;
  let panel: PanelGamePreview;

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no game in tests'))),
    );
    service = new PreviewLinkService(new THREE.Group(), {
      onCatalogLoaded: () => {},
      levelNameProvider: () => 'panel_test_level',
    });
    panel = new PanelGamePreview(document.body, service);
    panel.show();
  });

  afterEach(() => {
    service.disconnect();
    panel.dispose();
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('starts disconnected with the bake action unavailable', () => {
    const root = panel.getRootElement();
    expect(root.textContent).toContain('Not connected');
    expect(buttonFind(root, 'Preview Bake').disabled).toBe(true);
    buttonFind(root, 'Connect');
  });

  it('connects to the typed endpoint and offers to disconnect', () => {
    const root = panel.getRootElement();
    const endpointInput = root.querySelector<HTMLInputElement>('[aria-label="Game preview endpoint"]');
    if (!endpointInput) {
      throw new Error('Endpoint input missing');
    }
    endpointInput.value = 'http://127.0.0.1:16123';
    buttonFind(root, 'Connect').click();
    expect(service.endpointRead()).toBe('http://127.0.0.1:16123');
    expect(service.controllerRead()?.connectionStateRead()).toBe('connecting');
    buttonFind(root, 'Disconnect').click();
    expect(service.controllerRead()?.connectionStateRead()).toBe('disconnected');
    buttonFind(root, 'Connect');
  });
});
