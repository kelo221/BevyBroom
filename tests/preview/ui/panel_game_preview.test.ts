import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { PanelGamePreview } from '@/preview/ui/panel_game_preview.js';
import { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import {
  GAME_PROCESS_DESKTOP_ONLY_MESSAGE,
  GameProcessControlUnavailable,
} from '@/project/control/game_process_control.js';
import { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { ProjectWorkbenchLinkPreview } from '@/project/workbench/project_workbench_link_preview.js';
import { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { GameProcessControlFake } from '../../project/workbench/project_workbench_rig.js';

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

/**
 * Waits until pending promise callbacks ran.
 *
 * @returns Promise settled after the queued callbacks.
 */
async function promisesFlush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Unit tests for the game preview panel: connection controls, and the project
 * section offering game actions only where they make sense and explaining the
 * browser limits.
 */
describe('PanelGamePreview', () => {
  let service: PreviewLinkService;
  let panel: PanelGamePreview | null;
  let workbench: ProjectWorkbench | null;

  /**
   * Creates and shows a panel whose workbench uses the given control.
   *
   * @param control Game process control.
   * @returns Panel root element.
   */
  function panelOpen(control: GameProcessControlUnavailable | GameProcessControlFake): HTMLElement {
    const worldGroup = new THREE.Group();
    const link = new ProjectWorkbenchLinkPreview(service);
    workbench = new ProjectWorkbench({ control, link, worldGroup, recentStore: new ProjectRecentStore(null) });
    panel = new PanelGamePreview(document.body, service, workbench);
    panel.show();
    return panel.getRootElement();
  }

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
    panel = null;
    workbench = null;
  });

  afterEach(() => {
    service.disconnect();
    panel?.dispose();
    workbench?.dispose();
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('starts disconnected with the bake action unavailable', () => {
    const root = panelOpen(new GameProcessControlUnavailable());
    expect(root.textContent).toContain('Not connected');
    expect(buttonFind(root, 'Preview Bake').disabled).toBe(true);
    buttonFind(root, 'Connect');
  });

  it('connects to the typed endpoint and offers to disconnect', () => {
    const root = panelOpen(new GameProcessControlUnavailable());
    const endpointInput = root.querySelector<HTMLInputElement>('[aria-label="Game preview endpoint"]');
    if (!endpointInput) {
      throw new Error('Endpoint input missing');
    }
    endpointInput.focus();
    endpointInput.value = 'http://127.0.0.1:16123';
    buttonFind(root, 'Connect').click();
    expect(service.endpointRead()).toBe('http://127.0.0.1:16123');
    expect(service.controllerRead()?.connectionStateRead()).toBe('connecting');
    buttonFind(root, 'Disconnect').click();
    expect(service.controllerRead()?.connectionStateRead()).toBe('disconnected');
    buttonFind(root, 'Connect');
  });

  it('explains in the browser that games must be started by hand', () => {
    const root = panelOpen(new GameProcessControlUnavailable());
    expect(root.textContent).toContain(GAME_PROCESS_DESKTOP_ONLY_MESSAGE);
    expect(Array.from(root.querySelectorAll('button')).some((button) => button.textContent === 'Launch')).toBe(false);
  });

  it('offers game actions only after a project opened and connects on launch', async () => {
    const control = new GameProcessControlFake();
    const root = panelOpen(control);
    expect(buttonFind(root, 'Launch').disabled).toBe(true);
    control.chosenFile = '/games/panel game/broom.project.json';
    buttonFind(root, 'Open Project…').click();
    await promisesFlush();
    expect(root.textContent).toContain('Project: panel game');
    expect(buttonFind(root, 'Launch').disabled).toBe(false);
    expect(buttonFind(root, 'Stop').disabled).toBe(true);
    buttonFind(root, 'Launch').click();
    await promisesFlush();
    expect(control.actions).toEqual(['launch']);
    expect(service.endpointRead()).toBe('http://127.0.0.1:1/panel game');
    expect(service.controllerRead()?.connectionStateRead()).not.toBe('disconnected');
  });
});
