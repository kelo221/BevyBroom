import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ManagerSnap } from '@/transform/snap/manager_snap.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import type { CoordinatorCameraFit } from '@/navigation/camera/coordinator_camera_fit.js';
import type { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { LayoutViewportChromeHost } from '@/layout/setup/layout_viewport_chrome.js';
import type { ClipboardEditCommands } from '@/clipboard/controller/clipboard_edit_commands.js';
import {
  ShellWindowActionsLayout,
  type ShellWindowActionsLayoutSource,
} from '@/layout/shell/actions/shell_window_actions_layout.js';

/** Scene, selection and spies a window actions test works with. */
interface ShellWindowActionsFixture {
  actions: ShellWindowActionsLayout;
  source: ShellWindowActionsLayoutSource;
  worldObject: THREE.Group;
  selectionManager: ManagerSelection;
  snapManager: ManagerSnap;
  cameraFit: { onFitToSelection: ReturnType<typeof vi.fn>; onFitAllViewports: ReturnType<typeof vi.fn> };
}

/**
 * Creates a world with the given number of box meshes.
 *
 * @param meshCount Number of meshes to add.
 * @returns World root.
 */
function worldWithMeshesCreate(meshCount: number): THREE.Group {
  const worldObject = new THREE.Group();
  for (let meshIndex = 0; meshIndex < meshCount; meshIndex++) {
    worldObject.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  }
  return worldObject;
}

/**
 * Creates window actions over a fresh world, selection, grid and spy camera
 * fit.
 *
 * @param toolChrome Tool chrome returned by the source, or null.
 * @param clipboardEditCommands Clipboard commands returned by the source, or
 *   null.
 * @returns Window actions fixture.
 */
function fixtureCreate(
  toolChrome: ControllerViewportToolChrome | null = null,
  clipboardEditCommands: ClipboardEditCommands | null = null,
): ShellWindowActionsFixture {
  const worldObject = worldWithMeshesCreate(3);
  const selectionManager = new ManagerSelection();
  const snapManager = new ManagerSnap(1);
  const cameraFit = { onFitToSelection: vi.fn(), onFitAllViewports: vi.fn() };
  const source: ShellWindowActionsLayoutSource = {
    viewportChromeHostRead: () => ({ shadingModeCoordinator: undefined }) as unknown as LayoutViewportChromeHost,
    cameraFitCoordinatorRead: () => cameraFit as unknown as CoordinatorCameraFit,
    toolChromeRead: () => toolChrome,
    playModeStart: vi.fn(),
    shortcutLabelRead: (action) => `label:${action}`,
    clipboardEditCommandsRead: () => clipboardEditCommands,
    solidBrushToolsRead: () => null,
    selectionVisibilityRead: () => null,
    selectionManager,
    worldObject,
    snapManager,
  };
  const actions = new ShellWindowActionsLayout(source);
  return { actions, source, worldObject, selectionManager, snapManager, cameraFit };
}

describe('ShellWindowActionsLayout', () => {
  it('selects every mesh of the world and clears the selection again', () => {
    const fixture = fixtureCreate();
    fixture.actions.selectAll();
    const selectedObjects = fixture.selectionManager.getAllSelectedObjectsAsArray();
    expect(selectedObjects).toHaveLength(fixture.worldObject.children.length);
    for (const child of fixture.worldObject.children) {
      expect(selectedObjects).toContain(child);
    }
    fixture.actions.selectNone();
    expect(fixture.selectionManager.getAllSelectedObjectsAsArray()).toHaveLength(0);
  });

  it('reads, sets and reports the grid size through the snap manager', () => {
    const fixture = fixtureCreate();
    const listener = vi.fn();
    fixture.actions.gridIntervalChangeListenerAdd(listener);
    const nextInterval = fixture.actions.gridIntervalRead() * 2;
    fixture.actions.gridIntervalSet(nextInterval);
    expect(fixture.snapManager.getInterval()).toBe(nextInterval);
    expect(fixture.actions.gridIntervalRead()).toBe(nextInterval);
    expect(listener).toHaveBeenCalledWith(nextInterval);
  });

  it('frames the selection in the hovered view or in every view', () => {
    const fixture = fixtureCreate();
    fixture.actions.frameSelection();
    fixture.actions.frameAll();
    expect(fixture.cameraFit.onFitToSelection).toHaveBeenCalledOnce();
    expect(fixture.cameraFit.onFitAllViewports).toHaveBeenCalledOnce();
  });

  it('starts play mode and forwards shortcut labels', () => {
    const fixture = fixtureCreate();
    fixture.actions.playStart();
    expect(fixture.source.playModeStart).toHaveBeenCalledOnce();
    expect(fixture.actions.shortcutLabelRead('select_all')).toBe('label:select_all');
  });

  it('forwards the clipboard commands and reports no selection before the clipboard exists', () => {
    expect(fixtureCreate().actions.clipboardSelectionHasObjectsIs()).toBe(false);
    expect(() => fixtureCreate().actions.clipboardPaste()).not.toThrow();
    const commands = {
      copy: vi.fn(async () => undefined),
      cut: vi.fn(async () => undefined),
      paste: vi.fn(async () => undefined),
      pasteAtOriginalPosition: vi.fn(async () => undefined),
      selectionHasObjectsIs: () => true,
    };
    const fixture = fixtureCreate(null, commands as unknown as ClipboardEditCommands);
    fixture.actions.clipboardCopy();
    fixture.actions.clipboardCut();
    fixture.actions.clipboardPaste();
    fixture.actions.clipboardPasteAtOriginalPosition();
    expect(commands.copy).toHaveBeenCalledOnce();
    expect(commands.cut).toHaveBeenCalledOnce();
    expect(commands.paste).toHaveBeenCalledOnce();
    expect(commands.pasteAtOriginalPosition).toHaveBeenCalledOnce();
    expect(fixture.actions.clipboardSelectionHasObjectsIs()).toBe(true);
  });

  it('selects tools through the tool chrome and reads object select before it exists', () => {
    expect(fixtureCreate().actions.toolActiveRead()).toBe(EditorToolId.OBJECT);
    const toolChrome = { selectTool: vi.fn(), getActiveTool: () => EditorToolId.CLIP_PLANE };
    const fixture = fixtureCreate(toolChrome as unknown as ControllerViewportToolChrome);
    fixture.actions.toolSelect(EditorToolId.CLIP_PLANE);
    expect(toolChrome.selectTool).toHaveBeenCalledWith(EditorToolId.CLIP_PLANE);
    expect(fixture.actions.toolActiveRead()).toBe(EditorToolId.CLIP_PLANE);
  });
});
