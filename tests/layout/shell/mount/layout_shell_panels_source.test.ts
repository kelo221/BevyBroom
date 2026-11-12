import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  getStateFaceEditSession,
  setStateFaceEditSessionForTests,
  StateFaceEditSession,
} from '@/texture/paint/state_face_edit_session.js';
import {
  getStateEntityPlace,
  setStateEntityPlaceForTests,
  StateEntityPlace,
} from '@/tools/entity_place/state_entity_place.js';
import { setVisGroupSharedServicesForTests } from '@/visgroup/visgroup_shared_services.js';
import { setTextureMapCacheForTests, TextureMapCache } from '@/texture/library/texture_map_cache.js';
import type { LayoutShellPanels } from '@/layout/shell/mount/layout_shell_panels.js';
import {
  layoutShellPanelsCreate,
  type LayoutShellPanelsSource,
} from '@/layout/shell/mount/layout_shell_panels_source.js';
import type { ShellInspectorSlot } from '@/layout/shell/inspector/shell_inspector.js';
import { shellTestDocksCreate, shellTestDocksDispose, type ShellTestDocks } from '../shell_test_support.js';
import { entityBrowserTestEditorCreate } from '../../../entity_browser/entity_browser_test_support.js';
import { mockObjectUrlApis } from '../../../texture/library/utils_object_url_test.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  projectLevelActionsRigCreate,
  projectLevelRigProjectOpen,
} from '../../../project/level/project_level_test_support.js';
import { EditorToolId } from '@/types/editor_tool_id.js';

/** Inspector slots the docked panels fill. */
const LAYOUT_SHELL_PANELS_TEST_FILLED_SLOTS: readonly ShellInspectorSlot[] = [
  'hammer_object_bar',
  'hammer_visgroups',
  'hammer_prefabs',
  'map_layers',
];

/** Docks, panels and the editor parts a docked panels test works with. */
interface LayoutShellPanelsFixture {
  docks: ShellTestDocks;
  source: LayoutShellPanelsSource;
  panels: LayoutShellPanels;
  /** Project level rig behind the level browser. */
  levelRig: ReturnType<typeof projectLevelActionsRigCreate>;
}

/**
 * Builds the docked panels over real docks, a real map and spy refresh hooks.
 *
 * @returns Docked panels fixture.
 */
function fixtureCreate(): LayoutShellPanelsFixture {
  const docks = shellTestDocksCreate();
  const editor = entityBrowserTestEditorCreate();
  const commandStack = new CommandStack(32);
  const toolSelect = vi.fn((toolId: EditorToolId) =>
    getStateSprinkleTool().toolActiveWrite(toolId === EditorToolId.SPRINKLE),
  );
  const levelRig = projectLevelActionsRigCreate(editor.world);
  const source: LayoutShellPanelsSource = {
    docks,
    selectionManager: new ManagerSelection(),
    worldObject: editor.world,
    commandStack,
    layerManager: new LayerManager(editor.world),
    statusBar: null,
    faceController: new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), editor.world),
    addMenuActions: editor.actions,
    projectLevelActions: levelRig.actions,
    surfaceShadingRefresh: vi.fn(),
    refreshAfterWorldMutation: vi.fn(),
    selectionFrameAll: vi.fn(),
    viewportAtClientPointResolve: () => null,
    spawnCameraOverrideRun: (_camera, action) => action(),
    toolSelect,
  };
  return { docks, source, panels: layoutShellPanelsCreate(source), levelRig };
}

/**
 * Returns whether an inspector slot holds any mounted content.
 *
 * @param docks Docks holding the inspector.
 * @param slot Inspector slot.
 * @returns True when the slot has child elements.
 */
function inspectorSlotFilledIs(docks: ShellTestDocks, slot: ShellInspectorSlot): boolean {
  return docks.inspector.slotRead(slot).childElementCount > 0;
}

/**
 * Adds a box carrying a game component of a class nobody knows, which the
 * issues validation reports.
 *
 * @param worldObject Map root.
 * @returns The added box.
 */
function meshWithUnknownComponentAdd(worldObject: THREE.Group): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = 'Broken box';
  GameEntityComponentStore.write(mesh, { [`unknown_game::Thing${THREE.MathUtils.generateUUID()}`]: {} });
  worldObject.add(mesh);
  return mesh;
}

/** Installs fresh editor singletons the docked panels read. */
function singletonsInstall(): void {
  mockObjectUrlApis('blob:layout-shell-panels');
  setStateTexturePaintForTests(new StateTexturePaint());
  setTextureMapCacheForTests(new TextureMapCache());
  setStateFaceEditSessionForTests(new StateFaceEditSession());
  setStateEntityPlaceForTests(new StateEntityPlace());
  setVisGroupSharedServicesForTests(null);
}

/** Drops the editor singletons a test installed. */
function singletonsReset(): void {
  getStateSprinkleTool().reset();
  setStateTexturePaintForTests(null);
  setTextureMapCacheForTests(null);
  setStateFaceEditSessionForTests(null);
  setStateEntityPlaceForTests(null);
  setVisGroupSharedServicesForTests(null);
}

describe('layoutShellPanelsCreate', () => {
  let fixture: LayoutShellPanelsFixture;

  beforeEach(() => {
    singletonsInstall();
    fixture = fixtureCreate();
  });

  afterEach(() => {
    fixture.panels.dispose();
    shellTestDocksDispose(fixture.docks);
    singletonsReset();
    vi.restoreAllMocks();
  });

  it('fills the Hammer bar slots and the layers slot of the inspector', () => {
    LAYOUT_SHELL_PANELS_TEST_FILLED_SLOTS.forEach((slot) => {
      expect(inspectorSlotFilledIs(fixture.docks, slot)).toBe(true);
    });
    const objectBarSlot = fixture.docks.inspector.slotRead('hammer_object_bar');
    expect(objectBarSlot.contains(fixture.panels.hammerBar.objectBar.getElement())).toBe(true);
  });

  it('keeps the face inspector and the entity browser out of the inspector', () => {
    const inspectorElement = fixture.docks.inspector.getElement();
    expect(inspectorElement.contains(fixture.panels.faceInspectorParts.faceInspector.getElement())).toBe(false);
    expect(inspectorElement.contains(fixture.panels.entityBrowser.getElement())).toBe(false);
  });

  it('mounts the console and issues views into the info panel tabs', () => {
    expect(fixture.docks.infoPanel.slotRead('console').childElementCount).toBeGreaterThan(0);
    expect(fixture.docks.infoPanel.slotRead('issues').childElementCount).toBeGreaterThan(0);
  });

  it('opens the floating texture browser from Browse and activates the face inspector', () => {
    const faceInspector = fixture.panels.faceInspectorParts.faceInspector;
    const textureBrowser = fixture.panels.textureWindows.textureBrowser;
    expect(textureBrowser.isOpen()).toBe(false);
    expect(faceInspector.isVisible()).toBe(false);
    fixture.docks.inspector.getElement().querySelector<HTMLElement>('.shell-inspector-texture-browse')?.click();
    expect(textureBrowser.isOpen()).toBe(true);
    expect(textureBrowser.bodyRead().contains(faceInspector.getElement())).toBe(true);
    expect(faceInspector.isVisible()).toBe(true);
    textureBrowser.hide();
    expect(faceInspector.isVisible()).toBe(false);
  });

  it('opens the Face Edit Sheet for face mode and activates the face inspector', () => {
    fixture.panels.faceEditSheetReveal();
    expect(getStateFaceEditSession().sheetOpenRead()).toBe(true);
    expect(fixture.panels.faceInspectorParts.faceInspector.isVisible()).toBe(true);
  });

  it('opens the floating entity browser from the Entity tool Browse request and the View menu command', () => {
    const entityBrowserWindow = fixture.panels.entityBrowserWindow;
    getStateEntityPlace().browseRequest();
    expect(entityBrowserWindow.isOpen()).toBe(true);
    expect(entityBrowserWindow.bodyRead().contains(fixture.panels.entityBrowser.getElement())).toBe(true);
    fixture.docks.dockCommands.floatingWindowToggle('entity_browser');
    expect(fixture.docks.dockCommands.isFloatingWindowOpen('entity_browser')).toBe(false);
  });

  it('opens the floating level browser from the View menu command and the name-focused reveal', async () => {
    const levelBrowserWindow = fixture.panels.levelBrowserWindow;
    await projectLevelRigProjectOpen(fixture.levelRig);
    expect(levelBrowserWindow.isOpen()).toBe(false);
    fixture.docks.dockCommands.floatingWindowToggle('level_browser');
    expect(fixture.docks.dockCommands.isFloatingWindowOpen('level_browser')).toBe(true);
    expect(levelBrowserWindow.bodyRead().contains(levelBrowserWindow.levelBrowserRead().getElement())).toBe(true);
    fixture.docks.dockCommands.floatingWindowToggle('level_browser');
    fixture.panels.levelBrowserReveal(true);
    expect(levelBrowserWindow.isOpen()).toBe(true);
    expect(document.activeElement).toBe(levelBrowserWindow.levelBrowserRead().nameInputRead());
  });

  it('reports map issues and selects and frames the object of a clicked issue', () => {
    const brokenMesh = meshWithUnknownComponentAdd(fixture.source.worldObject);
    const issues = fixture.panels.issuesValidateNow();
    expect(issues.map((issue) => issue.objectUuid)).toContain(brokenMesh.uuid);
    const issueRow = fixture.docks.infoPanel.slotRead('issues').querySelector<HTMLElement>('.editor-issues-row');
    issueRow?.click();
    expect(fixture.source.selectionManager.getAllSelectedObjectsAsArray()).toContain(brokenMesh);
    expect(fixture.source.selectionFrameAll).toHaveBeenCalledOnce();
  });

  it('opens the Entity Sprinkle window with the Sprinkle tool and returns to Select when it is closed', () => {
    const sprinkleDialog = fixture.panels.sprinkleDialogMount.dialog;
    getStateSprinkleTool().toolActiveWrite(true);
    expect(sprinkleDialog.isOpen()).toBe(true);
    expect(fixture.docks.toolbarContainer.contains(sprinkleDialog.getRootElement())).toBe(true);
    sprinkleDialog.getRootElement().querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(fixture.source.toolSelect).toHaveBeenCalledExactlyOnceWith(EditorToolId.OBJECT);
    expect(sprinkleDialog.isOpen()).toBe(false);
  });

  it('removes every docked panel and the Browse delegate on dispose', () => {
    fixture.panels.dispose();
    LAYOUT_SHELL_PANELS_TEST_FILLED_SLOTS.forEach((slot) => {
      expect(inspectorSlotFilledIs(fixture.docks, slot)).toBe(false);
    });
    expect(fixture.docks.infoPanel.slotRead('issues').childElementCount).toBe(0);
    getStateEntityPlace().browseRequest();
    expect(fixture.panels.entityBrowserWindow.isOpen()).toBe(false);
  });
});
