import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { ENTITY_BROWSER_DRAG_THRESHOLD_PX } from '@/entity_browser/drag/entity_browser_drag_session.js';
import { entityBrowserSetup } from '@/entity_browser/setup/entity_browser_setup.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import { ENTITY_BROWSER_TILE_ID_ATTRIBUTE } from '@/entity_browser/ui/entity_browser_tile.js';
import { GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX } from '@/game_entity/ui/game_entity_add_menu_section.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import { testClassesInstall, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';
import { entityBrowserTestEditorCreate, type EntityBrowserTestEditor } from '../entity_browser_test_support.js';

/** A browser created through the layout setup with its world change source. */
interface SetupBrowser {
  readonly browser: EntityBrowser;
  readonly editor: EntityBrowserTestEditor;
  readonly worldListeners: Set<() => void>;
  readonly viewportElement: HTMLElement;
  readonly spawnCameras: THREE.Camera[];
}

/**
 * Creates a browser through {@link entityBrowserSetup} over a test editor with
 * one viewport element covering the whole client area.
 *
 * @returns Browser and its host pieces.
 */
function setupBrowserCreate(): SetupBrowser {
  const editor = entityBrowserTestEditorCreate();
  const worldListeners = new Set<() => void>();
  const viewportElement = viewportElementCreate();
  const spawnCameras: THREE.Camera[] = [];
  const browser = entityBrowserSetup({
    worldObject: editor.world,
    addMenuActions: editor.actions,
    viewportAtClientPointResolve: () => ({ camera: editor.camera, pickElement: viewportElement }),
    spawnCameraOverrideRun: (camera, action) => {
      spawnCameras.push(camera);
      editor.handler.spawnCameraOverrideRun(camera, action);
    },
    worldChangeSubscribe: (listener) => worldListenerAdd(worldListeners, listener),
    settingsStore: new EntityBrowserSettingsStore(new MemorySettingsStorage()),
  });
  document.body.appendChild(browser.getElement());
  return { browser, editor, worldListeners, viewportElement, spawnCameras };
}

/**
 * Creates and mounts a viewport element covering an 800 by 600 client area.
 *
 * @returns Viewport element.
 */
function viewportElementCreate(): HTMLElement {
  const viewportElement = document.createElement('div');
  viewportElement.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
  document.body.appendChild(viewportElement);
  return viewportElement;
}

/**
 * Adds a world change listener and returns its removal.
 *
 * @param worldListeners Listener set of the fake world change source.
 * @param listener Listener to add.
 * @returns Function that removes the listener.
 */
function worldListenerAdd(worldListeners: Set<() => void>, listener: () => void): () => void {
  worldListeners.add(listener);
  return () => worldListeners.delete(listener);
}

/**
 * Returns the ids of the shown tiles.
 *
 * @param browser Browser.
 * @returns Entry ids.
 */
function shownIds(browser: EntityBrowser): string[] {
  return browser.shownEntriesList().map((entry) => entry.id);
}

/**
 * The layout setup wires drops to viewport placement, map changes to usage
 * counts and game class changes to the catalog.
 */
describe('entityBrowserSetup', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    document.body.replaceChildren();
  });

  it('places a dropped tile in the viewport under the drop point', () => {
    const { browser, editor, viewportElement, spawnCameras } = setupBrowserCreate();
    cleanups.push(() => browser.dispose());
    const tile = browser.getElement().querySelector(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="portals.portal"]`);
    if (!tile) throw new Error('missing portal tile');
    tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, button: 0 }));
    const moved = 5 + ENTITY_BROWSER_DRAG_THRESHOLD_PX * 2;
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: moved, clientY: moved }));
    viewportElement.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 600, clientY: 150 }));
    expect(spawnCameras).toHaveLength(1);
    expect(editor.world.children).toHaveLength(1);
  });

  it('refreshes usage when the map changes and stops listening once disposed', () => {
    const { browser, editor, worldListeners } = setupBrowserCreate();
    browser.optionsUpdate({ usedOnly: true });
    expect(shownIds(browser)).toEqual([]);
    editor.actions.onAddCylinder();
    worldListeners.forEach((listener) => listener());
    expect(shownIds(browser)).toEqual(['geometry.cylinder']);
    browser.dispose();
    expect(worldListeners.size).toBe(0);
  });

  it('shows game classes as soon as the game reports them', () => {
    const { browser } = setupBrowserCreate();
    cleanups.push(() => browser.dispose());
    const doorId = `${GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX}${testDoorClassCreate().type_path}`;
    expect(shownIds(browser)).not.toContain(doorId);
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    expect(shownIds(browser)).toContain(doorId);
  });

  it('stops following game class changes once disposed', () => {
    const { browser } = setupBrowserCreate();
    const refresh = vi.spyOn(browser, 'refresh');
    browser.dispose();
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    expect(refresh).not.toHaveBeenCalled();
  });
});
