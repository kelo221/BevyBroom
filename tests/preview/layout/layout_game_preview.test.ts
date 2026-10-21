import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  LayoutGamePreview,
  LAYOUT_GAME_PREVIEW_CATALOG_FOLDER_NAME,
  LAYOUT_GAME_PREVIEW_FALLBACK_LEVEL_NAME,
  layoutGamePreviewLevelNameFromFileName,
  type LayoutGamePreviewHosts,
} from '@/preview/layout/layout_game_preview.js';
import type { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/**
 * Creates layout hosts backed by spies.
 *
 * @param sceneFileName File name returned for the scene document.
 * @returns Hosts plus the spies to inspect.
 */
function hostsCreate(sceneFileName: string | null): {
  hosts: LayoutGamePreviewHosts;
  applyEntries: ReturnType<typeof vi.fn>;
  statusMessages: string[];
} {
  const applyEntries = vi.fn();
  const statusMessages: string[] = [];
  const hosts: LayoutGamePreviewHosts = {
    worldGroup: new THREE.Group(),
    panelHost: document.body,
    textureBrowserControllerRead: () => ({ applyEntries }) as unknown as ControllerTextureBrowser,
    sceneFileNameRead: () => sceneFileName,
    statusMessageShow: (message) => statusMessages.push(message),
  };
  return { hosts, applyEntries, statusMessages };
}

describe('layoutGamePreviewLevelNameFromFileName', () => {
  it('drops the extension and replaces characters a file name cannot safely hold', () => {
    expect(layoutGamePreviewLevelNameFromFileName('My Level (v2).json')).toBe('my_level_v2');
    expect(layoutGamePreviewLevelNameFromFileName('castle-keep.json')).toBe('castle-keep');
  });

  it('falls back when the scene is unsaved or the name has no usable characters', () => {
    expect(layoutGamePreviewLevelNameFromFileName(null)).toBe(LAYOUT_GAME_PREVIEW_FALLBACK_LEVEL_NAME);
    expect(layoutGamePreviewLevelNameFromFileName('###.json')).toBe(LAYOUT_GAME_PREVIEW_FALLBACK_LEVEL_NAME);
  });
});

describe('LayoutGamePreview', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('derives the level name from the current scene file', () => {
    const layout = new LayoutGamePreview(hostsCreate('Harbor Docks.json').hosts);
    expect(layout.levelNameRead()).toBe('harbor_docks');
  });

  it('shows a loaded catalog in the texture browser and reports it', () => {
    const { hosts, applyEntries, statusMessages } = hostsCreate(null);
    const layout = new LayoutGamePreview(hosts);
    const entries = [{ id: 'stone_wall' }, { id: 'wood_floor' }] as unknown as TextureBrowserEntry[];
    layout.catalogApply({ entries, generation: 1, textureGeneration: 0, error: '' });
    expect(applyEntries).toHaveBeenCalledWith(LAYOUT_GAME_PREVIEW_CATALOG_FOLDER_NAME, entries);
    expect(statusMessages[statusMessages.length - 1]).toContain(String(entries.length));
  });

  it('reports the catalog error instead of the count when the game sent one', () => {
    const { hosts, statusMessages } = hostsCreate(null);
    new LayoutGamePreview(hosts).catalogApply({
      entries: [],
      generation: 2,
      textureGeneration: 0,
      error: 'bad catalog',
    });
    expect(statusMessages[statusMessages.length - 1]).toBe('bad catalog');
  });

  it('creates a single service and mounts its panel on the first toggle', () => {
    const layout = new LayoutGamePreview(hostsCreate(null).hosts);
    expect(layout.serviceEnsure()).toBe(layout.serviceEnsure());
    expect(document.body.querySelector('[aria-label="Game preview endpoint"]')).toBeNull();
    layout.panelToggle();
    expect(document.body.querySelector('[aria-label="Game preview endpoint"]')).not.toBeNull();
  });
});
