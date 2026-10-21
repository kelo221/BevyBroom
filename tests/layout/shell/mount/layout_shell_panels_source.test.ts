import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { setStateTexturePaintForTests, StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
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

/** Docks, panels and the editor parts a docked panels test works with. */
interface LayoutShellPanelsFixture {
  docks: ShellTestDocks;
  source: LayoutShellPanelsSource;
  panels: LayoutShellPanels;
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
  const source: LayoutShellPanelsSource = {
    docks,
    selectionManager: new ManagerSelection(),
    worldObject: editor.world,
    commandStack,
    layerManager: new LayerManager(editor.world),
    statusBar: null,
    faceController: new ControllerFaceExtrusion(new THREE.Scene(), commandStack, new GridSnap(false, 1), editor.world),
    addMenuActions: editor.actions,
    surfaceShadingRefresh: vi.fn(),
    refreshAfterWorldMutation: vi.fn(),
    selectionFrameAll: vi.fn(),
    viewportAtClientPointResolve: () => null,
    spawnCameraOverrideRun: (_camera, action) => action(),
  };
  return { docks, source, panels: layoutShellPanelsCreate(source) };
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

describe('layoutShellPanelsCreate', () => {
  let fixture: LayoutShellPanelsFixture;

  beforeEach(() => {
    mockObjectUrlApis('blob:layout-shell-panels');
    setStateTexturePaintForTests(new StateTexturePaint());
    setTextureMapCacheForTests(new TextureMapCache());
    fixture = fixtureCreate();
  });

  afterEach(() => {
    fixture.panels.dispose();
    shellTestDocksDispose(fixture.docks);
    setStateTexturePaintForTests(null);
    setTextureMapCacheForTests(null);
    vi.restoreAllMocks();
  });

  it('mounts the layers, entity browser and face inspector into their inspector slots', () => {
    expect(inspectorSlotFilledIs(fixture.docks, 'map_layers')).toBe(true);
    expect(inspectorSlotFilledIs(fixture.docks, 'entity_browser')).toBe(true);
    expect(
      fixture.docks.inspector.slotRead('face').contains(fixture.panels.faceInspectorParts.faceInspector.getElement()),
    ).toBe(true);
    expect(fixture.docks.inspector.slotRead('entity_browser').contains(fixture.panels.entityBrowser.getElement())).toBe(
      true,
    );
  });

  it('mounts the console and issues views into the info panel tabs', () => {
    expect(fixture.docks.infoPanel.slotRead('console').childElementCount).toBeGreaterThan(0);
    expect(fixture.docks.infoPanel.slotRead('issues').childElementCount).toBeGreaterThan(0);
  });

  it('keeps the face inspector active only while the Face tab is shown', () => {
    const faceInspector = fixture.panels.faceInspectorParts.faceInspector;
    fixture.docks.dockCommands.inspectorTabReveal('map');
    expect(faceInspector.isVisible()).toBe(false);
    fixture.panels.faceInspectorReveal();
    expect(fixture.docks.inspector.activeTabIdRead()).toBe('face');
    expect(faceInspector.isVisible()).toBe(true);
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

  it('removes every docked panel on dispose', () => {
    fixture.panels.dispose();
    const slots: ShellInspectorSlot[] = ['map_layers', 'entity_browser', 'face'];
    slots.forEach((slot) => expect(inspectorSlotFilledIs(fixture.docks, slot)).toBe(false));
    expect(fixture.docks.infoPanel.slotRead('issues').childElementCount).toBe(0);
  });
});
