import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityBrowserCatalogBuilder } from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserPlacementAtClientPoint } from '@/entity_browser/placement/entity_browser_placement_at_client_point.js';
import { entityBrowserSetup } from '@/entity_browser/setup/entity_browser_setup.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import { ENTITY_BROWSER_TILE_ID_ATTRIBUTE } from '@/entity_browser/ui/entity_browser_tile.js';
import { prefabEditorActionsActive } from '@/prefab/actions/prefab_editor_actions_active.js';
import { getPrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PREFAB_ADD_MENU_SECTION_LABEL, prefabCatalogIdOf } from '@/prefab/ui/prefab_add_menu_section.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import { isMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { entityBrowserTestEditorCreate } from '../../entity_browser/entity_browser_test_support.js';
import {
  prefabActionsTestBoundsRead,
  prefabActionsTestBoxAdd,
  prefabActionsTestRigCreate,
  prefabActionsTestTemplateAdd,
  type PrefabActionsTestRig,
} from '../actions/prefab_actions_test_support.js';

/** Browsers mounted by the running test. */
const mountedBrowsers: EntityBrowser[] = [];

/**
 * Builds prefab actions over the shared prefab catalog and makes them active.
 *
 * @returns Test rig.
 */
function sharedRigCreate(): PrefabActionsTestRig {
  const rig = prefabActionsTestRigCreate(getPrefabCatalogStore());
  prefabEditorActionsActive.write(rig.actions);
  return rig;
}

/**
 * Adds a prefab captured from a box that is then removed from the world.
 *
 * @param rig Test rig.
 * @param name Prefab name.
 * @param category Prefab category.
 * @returns Prefab id.
 */
function prefabAdd(rig: PrefabActionsTestRig, name: string, category: string): string {
  const box = prefabActionsTestBoxAdd(
    rig.testWorld.world,
    name,
    new THREE.Vector3(2, 3, 2),
    new THREE.Vector3(9, 4, -6),
  );
  const id = prefabActionsTestTemplateAdd(rig, name, category, [box]).id;
  box.removeFromParent();
  return id;
}

/**
 * Returns the catalog entry of a prefab.
 *
 * @param prefabId Prefab id.
 * @returns Catalog entry.
 */
function prefabEntryFind(prefabId: string): EntityBrowserCatalogEntry {
  const catalog = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestEditorCreate().actions);
  const entry = catalog.find((candidate) => candidate.id === prefabCatalogIdOf(prefabId));
  if (entry === undefined) throw new Error(`prefab ${prefabId} is not in the catalog`);
  return entry;
}

/**
 * Mounts an entity browser built the way the editor builds it.
 *
 * @returns Browser.
 */
function browserMount(): EntityBrowser {
  const editor = entityBrowserTestEditorCreate();
  const browser = entityBrowserSetup({
    worldObject: editor.world,
    addMenuActions: editor.actions,
    viewportAtClientPointResolve: () => null,
    spawnCameraOverrideRun: (_camera, action) => action(),
    settingsStore: new EntityBrowserSettingsStore(new MemorySettingsStorage()),
  });
  document.body.appendChild(browser.getElement());
  mountedBrowsers.push(browser);
  return browser;
}

/**
 * Returns the labels of a menu's actions.
 *
 * @param entries Menu entries.
 * @returns Action labels in order.
 */
function actionLabels(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.filter(isMenuAction).map((entry) => entry.label);
}

afterEach(() => {
  mountedBrowsers.splice(0).forEach((browser) => browser.dispose());
  const store = getPrefabCatalogStore();
  store.templatesRead().forEach((template) => store.templateRemove(template.id));
  const actions = prefabEditorActionsActive.read();
  if (actions !== null) prefabEditorActionsActive.releaseIfStored(actions);
  document.body.replaceChildren();
});

/** Prefabs are tiles of the entity browser, placed and managed from there. */
describe('prefabs in the entity browser', () => {
  it('lists every prefab as a tile under Prefabs and its category, with a 3D preview', () => {
    const rig = sharedRigCreate();
    const doorId = prefabAdd(rig, 'Vault Door', 'Doors');
    const shelfId = prefabAdd(rig, 'Tall Shelf', 'Shelves');
    const doorEntry = prefabEntryFind(doorId);
    expect(doorEntry.label).toBe('Vault Door');
    expect(doorEntry.category).toBe(`${PREFAB_ADD_MENU_SECTION_LABEL} / Doors`);
    expect(prefabEntryFind(shelfId).category).toBe(`${PREFAB_ADD_MENU_SECTION_LABEL} / Shelves`);
    const preview = doorEntry.previewCreate?.() ?? null;
    expect(preview === null ? 0 : new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3()).y).toBeCloseTo(
      3,
      4,
    );
  });

  it('names a category equal to the section once and leaves the map usage line out of prefab tooltips', () => {
    const rig = sharedRigCreate();
    const prefabId = prefabAdd(rig, 'Crate Stack', PREFAB_ADD_MENU_SECTION_LABEL);
    expect(prefabEntryFind(prefabId).category).toBe(PREFAB_ADD_MENU_SECTION_LABEL);
    const browser = browserMount();
    const tile = browser
      .getElement()
      .querySelector<HTMLElement>(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="${prefabCatalogIdOf(prefabId)}"]`);
    expect(tile?.title).toContain('Crate Stack');
    expect(tile?.title).not.toContain('Used');
  });

  it('places a dropped prefab tile resting on the floor under the drop point', () => {
    const rig = sharedRigCreate();
    const prefabId = prefabAdd(rig, 'Crate', 'Props');
    const target = new THREE.Vector3(-4, 2, 7);
    prefabActionsTestBoxAdd(rig.testWorld.world, 'Floor', new THREE.Vector3(50, 1, 50), target.clone().setY(1));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    camera.position.copy(target).add(new THREE.Vector3(0, 15, 12));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const pickElement = document.createElement('div');
    pickElement.getBoundingClientRect = () => new DOMRect(100, 50, 400, 400);
    const placement = new EntityBrowserPlacementAtClientPoint({
      viewportAtClientPointResolve: () => ({ camera, pickElement }),
      spawnCameraOverrideRun: () => {
        throw new Error('prefabs place themselves at the aim');
      },
    });
    expect(placement.place(prefabEntryFind(prefabId), 300, 250)).toBe(true);
    const roots = rig.testWorld.selectionManager.getInspectorObjects();
    const bounds = prefabActionsTestBoundsRead(roots);
    expect(bounds.min.y).toBeCloseTo(target.y, 4);
    expect(bounds.getCenter(new THREE.Vector3()).setY(target.y).distanceTo(target)).toBeLessThan(1e-3);
  });

  it('shows one category with the filter and finds prefabs by category with the search', () => {
    const rig = sharedRigCreate();
    const doorId = prefabAdd(rig, 'Vault Door', 'Doors');
    prefabAdd(rig, 'Tall Shelf', 'Shelves');
    const browser = browserMount();
    browser.optionsUpdate({ categoryFilter: PREFAB_ADD_MENU_SECTION_LABEL });
    expect(browser.shownEntriesList().every((entry) => entry.id.startsWith('prefab.'))).toBe(true);
    expect(browser.shownEntriesList()).toHaveLength(2);
    browser.optionsUpdate({ categoryFilter: '', searchText: 'doors' });
    expect(browser.shownEntriesList().map((entry) => entry.id)).toEqual([prefabCatalogIdOf(doorId)]);
  });

  it('adds the tile of a new prefab, selected, and drops the tile of a deleted one', () => {
    const rig = sharedRigCreate();
    const browser = browserMount();
    const prefabId = prefabAdd(rig, 'Bench', 'Props');
    const tile = browser
      .getElement()
      .querySelector(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="${prefabCatalogIdOf(prefabId)}"]`);
    expect(tile?.getAttribute('aria-selected')).toBe('true');
    rig.actions.remove(prefabId);
    expect(browser.shownEntriesList().some((entry) => entry.id === prefabCatalogIdOf(prefabId))).toBe(false);
  });

  it('offers Rename, Change Category, Delete and Reveal File on a prefab tile, Reveal only for project files', () => {
    const rig = sharedRigCreate();
    const entries = prefabEntryFind(prefabAdd(rig, 'Lamp', 'Props')).contextEntriesCreate?.() ?? [];
    expect(actionLabels(entries)).toEqual(['Rename…', 'Change Category…', 'Delete', 'Reveal File']);
    const reveal = entries.filter(isMenuAction).find((entry) => entry.label === 'Reveal File');
    expect(reveal?.isEnabled?.()).toBe(false);
  });

  it('opens the tile menu on right-click and deletes the prefab from it', () => {
    const rig = sharedRigCreate();
    const prefabId = prefabAdd(rig, 'Bin', 'Props');
    const browser = browserMount();
    const tile = browser
      .getElement()
      .querySelector(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}="${prefabCatalogIdOf(prefabId)}"]`);
    tile?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 }));
    const deleteItem = [...document.querySelectorAll<HTMLElement>('*')].find(
      (element) => element.childElementCount === 0 && element.textContent === 'Delete',
    );
    deleteItem?.closest<HTMLElement>('[role="menuitem"], button, div')?.click();
    expect(rig.store.templateFind(prefabId)).toBeNull();
  });
});
