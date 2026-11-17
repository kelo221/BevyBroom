import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApiEntityBrowser } from '@/ai/client/editor_api_entity_browser.js';
import type { EditorApiHost } from '@/ai/client/editor_api_host.js';
import { okResult } from '@/ai/client/editor_api_result.js';
import { entityBrowserSetup } from '@/entity_browser/setup/entity_browser_setup.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import { prefabEditorActionsActive } from '@/prefab/actions/prefab_editor_actions_active.js';
import { getPrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { prefabCatalogIdOf } from '@/prefab/ui/prefab_add_menu_section.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { entityBrowserTestEditorCreate } from '../../entity_browser/entity_browser_test_support.js';
import {
  prefabActionsTestBoundsRead,
  prefabActionsTestBoxAdd,
  prefabActionsTestRigCreate,
  prefabActionsTestTemplateAdd,
  type PrefabActionsTestRig,
} from '../../prefab/actions/prefab_actions_test_support.js';

/** Browsers mounted by the running test. */
const mountedBrowsers: EntityBrowser[] = [];

/** Client rectangle of the test view. */
const VIEW_RECT = new DOMRect(400, 80, 600, 450);

/** A perspective view, a browser showing a prefab and the tools over them. */
interface EntityBrowserToolsRig {
  readonly prefabRig: PrefabActionsTestRig;
  readonly tools: EditorApiEntityBrowser;
  readonly prefabId: string;
  readonly floorCentre: THREE.Vector3;
}

/**
 * Builds a test view looking down at a floor, a mounted entity browser over the
 * shared prefab catalog with one prefab, and the entity browser tools.
 *
 * @returns Test rig.
 */
function toolsRigCreate(): EntityBrowserToolsRig {
  const prefabRig = prefabActionsTestRigCreate(getPrefabCatalogStore());
  prefabEditorActionsActive.write(prefabRig.actions);
  const box = prefabActionsTestBoxAdd(
    prefabRig.testWorld.world,
    'Bench',
    new THREE.Vector3(3, 1, 1),
    new THREE.Vector3(30, 2, 30),
  );
  const prefabId = prefabActionsTestTemplateAdd(prefabRig, 'Bench', 'Props', [box]).id;
  box.removeFromParent();
  const floorCentre = new THREE.Vector3(-3, 0.5, 4);
  prefabActionsTestBoxAdd(
    prefabRig.testWorld.world,
    'Floor',
    new THREE.Vector3(40, 0.5, 40),
    floorCentre.clone().setY(0),
  );
  const view = viewCreate(floorCentre);
  browserMount(view);
  const host = { viewportsInteractiveRead: () => [view] } as unknown as EditorApiHost;
  const tools = new EditorApiEntityBrowser(host, () => okResult('Selection', {}));
  return { prefabRig, tools, prefabId, floorCentre };
}

/**
 * Builds a perspective view looking at a point.
 *
 * @param target Point in the middle of the view.
 * @returns View with its camera and content element.
 */
function viewCreate(target: THREE.Vector3): {
  getViewportKind(): ViewportKind;
  getContentElement(): HTMLElement;
  getCamera(): THREE.Camera;
} {
  const camera = new THREE.PerspectiveCamera(50, VIEW_RECT.width / VIEW_RECT.height, 0.1, 500);
  camera.position.copy(target).add(new THREE.Vector3(6, 14, 10));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const element = document.createElement('div');
  element.getBoundingClientRect = () => VIEW_RECT;
  document.body.appendChild(element);
  return { getViewportKind: () => ViewportKind.PERSPECTIVE, getContentElement: () => element, getCamera: () => camera };
}

/**
 * Mounts an entity browser whose drops land in the test view.
 *
 * @param view Test view.
 */
function browserMount(view: ReturnType<typeof viewCreate>): void {
  const editor = entityBrowserTestEditorCreate();
  const isInView = (x: number, y: number): boolean =>
    x >= VIEW_RECT.left && x <= VIEW_RECT.right && y >= VIEW_RECT.top && y <= VIEW_RECT.bottom;
  const browser = entityBrowserSetup({
    worldObject: editor.world,
    addMenuActions: editor.actions,
    viewportAtClientPointResolve: (x, y) =>
      isInView(x, y) ? { camera: view.getCamera(), pickElement: view.getContentElement() } : null,
    spawnCameraOverrideRun: (_camera, action) => action(),
    settingsStore: new EntityBrowserSettingsStore(new MemorySettingsStorage()),
  });
  document.body.appendChild(browser.getElement());
  mountedBrowsers.push(browser);
}

afterEach(() => {
  mountedBrowsers.splice(0).forEach((browser) => browser.dispose());
  const store = getPrefabCatalogStore();
  store.templatesRead().forEach((template) => store.templateRemove(template.id));
  const actions = prefabEditorActionsActive.read();
  if (actions !== null) prefabEditorActionsActive.releaseIfStored(actions);
  document.body.replaceChildren();
});

/** MCP tools that read and drag Entity Browser tiles like a user. */
describe('EditorApiEntityBrowser', () => {
  it('lists the shown tiles with their ids, labels and categories', () => {
    const { tools, prefabId } = toolsRigCreate();
    const result = tools.entityBrowserToolDispatch('get_entity_browser_tiles', {});
    const tiles = (result?.data as { tiles: { id: string; label: string; category: string }[] }).tiles;
    expect(tiles).toContainEqual(
      expect.objectContaining({ id: prefabCatalogIdOf(prefabId), label: 'Bench', category: 'Prefabs / Props' }),
    );
  });

  it('drags a prefab tile into a view and places the prefab resting on the floor at the drop point', () => {
    const { prefabRig, tools, prefabId, floorCentre } = toolsRigCreate();
    const dropAt = floorCentre.clone().add(new THREE.Vector3(2, 0, -1));
    const result = tools.entityBrowserToolDispatch('entity_browser_drag', {
      tileId: prefabCatalogIdOf(prefabId),
      view: 'perspective',
      at: { x: dropAt.x, y: dropAt.y, z: dropAt.z },
    });
    expect(result?.ok).toBe(true);
    const placed = prefabActionsTestBoundsRead(prefabRig.testWorld.selectionManager.getInspectorObjects());
    expect(placed.min.y).toBeCloseTo(floorCentre.y, 3);
    expect(placed.getCenter(new THREE.Vector3()).setY(dropAt.y).distanceTo(dropAt)).toBeLessThan(0.01);
  });

  it('refuses a tile that is not shown and an unknown view', () => {
    const { tools, prefabId } = toolsRigCreate();
    expect(
      tools.entityBrowserToolDispatch('entity_browser_drag', {
        tileId: 'prefab.missing',
        view: 'perspective',
        at: { x: 0, y: 0, z: 0 },
      })?.ok,
    ).toBe(false);
    expect(
      tools.entityBrowserToolDispatch('entity_browser_drag', {
        tileId: prefabCatalogIdOf(prefabId),
        view: 'top',
        at: { x: 0, y: 0, z: 0 },
      })?.ok,
    ).toBe(false);
    expect(tools.entityBrowserToolDispatch('get_selection', {})).toBeNull();
  });
});
