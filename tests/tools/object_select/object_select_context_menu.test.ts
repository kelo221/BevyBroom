import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { GESTURE_SECONDARY_CLICK_DRAG_THRESHOLD_PX } from '@/input/gesture/gesture_secondary_click.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ObjectSelectContextMenu } from '@/tools/object_select/object_select_context_menu.js';
import { objectSelectDoubleClickToolReady } from '@/tools/object_select/object_select_double_click_tool_ready.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import type { PointerClientPoint } from '@/utils/pointer_client_project.js';
import { editorTestServicesCreate } from '../../editor/editor_test_services.js';
import {
  objectDragTestBoxMeshCreate,
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from '../object_drag/object_drag_test_viewport.js';

/** Scene, editor and right-click menu one test works with. */
interface ContextMenuTestRig {
  readonly editor: EditorWindow;
  readonly bridge: EditorInputBridge;
  readonly testViewport: ObjectDragTestViewport;
  readonly selectionManager: ManagerSelection;
  readonly contextMenu: ObjectSelectContextMenu;
  readonly firstBrush: THREE.Mesh;
  readonly secondBrush: THREE.Mesh;
  readonly runShown: ReturnType<typeof vi.fn>;
  readonly runHidden: ReturnType<typeof vi.fn>;
}

/** Rig of the running test, torn down after it. */
let contextMenuTestRig: ContextMenuTestRig | null = null;

/**
 * Builds the menu entries the test menu shows: one enabled row and one row that
 * does not apply.
 *
 * @param runShown Action of the shown row.
 * @param runHidden Action of the hidden row.
 * @returns Menu entries.
 */
function contextMenuTestEntries(runShown: () => void, runHidden: () => void): ToolbarMenuEntry[] {
  return [
    { label: 'Shown Command', onClick: runShown },
    { label: 'Hidden Command', onClick: runHidden, isEnabled: () => false },
  ];
}

/**
 * Creates two brushes side by side, a top view over them, the object tool
 * editor routed through the real input bridge, and the right-click menu armed
 * by the tool's right-button presses.
 *
 * @param isAllowed Whether the layout allows the menu.
 * @returns Test rig.
 */
function contextMenuRigCreate(isAllowed = true): ContextMenuTestRig {
  const worldObject = new THREE.Group();
  const boxSize = new THREE.Vector3(2, 2, 2);
  const firstBrush = objectDragTestBoxMeshCreate(worldObject, boxSize, new THREE.Vector3(-3, 0, 0));
  const secondBrush = objectDragTestBoxMeshCreate(worldObject, boxSize, new THREE.Vector3(3, 0, 0));
  const testViewport = objectDragTestViewportCreate(ViewportKind.TOP, [firstBrush, secondBrush]);
  const selectionManager = new ManagerSelection();
  const editor = new EditorWindow();
  const runShown = vi.fn();
  const runHidden = vi.fn();
  const contextMenu = new ObjectSelectContextMenu({
    selectionManager,
    pickObjectStackAtClientPoint: (clientX, clientY) =>
      testViewport.source.getObjectPickStack({ clientX, clientY } as MouseEvent),
    entriesBuild: () => contextMenuTestEntries(runShown, runHidden),
    isContextMenuAllowed: () => isAllowed && objectSelectDoubleClickToolReady(editor.activeTool),
  });
  editor.setServices(
    editorTestServicesCreate({
      objectContextMenuPressBegin: (clientX, clientY) => contextMenu.pressBegin(window, clientX, clientY),
    }),
  );
  const bridge = contextMenuBridgeInstall(editor, testViewport);
  const rig = {
    editor,
    bridge,
    testViewport,
    selectionManager,
    contextMenu,
    firstBrush,
    secondBrush,
    runShown,
    runHidden,
  };
  contextMenuTestRig = rig;
  return rig;
}

/**
 * Activates the Bounds tool and routes the test viewport's pointer events
 * through a real input bridge.
 *
 * @param editor Object tool editor.
 * @param testViewport Test viewport.
 * @returns Installed input bridge.
 */
function contextMenuBridgeInstall(editor: EditorWindow, testViewport: ObjectDragTestViewport): EditorInputBridge {
  editor.validateTools();
  editor.userSwitchToBoundsTool();
  document.body.appendChild(testViewport.element);
  const bridge = new EditorInputBridge(editor);
  bridge.install(document.body);
  bridge.setExclusiveViewportRoots([testViewport.element]);
  return bridge;
}

/**
 * Dispatches one pointer event of a button on the test viewport.
 *
 * @param rig Test rig.
 * @param type Pointer event type.
 * @param point Client point.
 * @param button Changed button index, -1 for moves.
 * @param buttons Held buttons mask.
 */
function contextMenuPointerDispatch(
  rig: ContextMenuTestRig,
  type: string,
  point: PointerClientPoint,
  button: number,
  buttons: number,
): void {
  rig.testViewport.element.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, ...point, button, buttons }),
  );
}

/**
 * Presses and releases a mouse button, optionally moving between them.
 *
 * @param rig Test rig.
 * @param point Press point.
 * @param button Button index: 0 left, 2 right.
 * @param travelPx Pointer travel to the right before the release.
 */
function contextMenuClick(rig: ContextMenuTestRig, point: PointerClientPoint, button: number, travelPx = 0): void {
  const mask = button === 2 ? 2 : 1;
  contextMenuPointerDispatch(rig, 'pointerdown', point, button, mask);
  const releasePoint = { clientX: point.clientX + travelPx, clientY: point.clientY };
  if (travelPx > 0) {
    contextMenuPointerDispatch(rig, 'pointermove', releasePoint, -1, mask);
  }
  contextMenuPointerDispatch(rig, 'pointerup', releasePoint, button, 0);
}

/**
 * Returns the client point over the center of a brush.
 *
 * @param rig Test rig.
 * @param brush Brush to point at.
 * @returns Client point.
 */
function contextMenuBrushPoint(rig: ContextMenuTestRig, brush: THREE.Mesh): PointerClientPoint {
  return objectDragTestClientPoint(rig.testViewport, brush.getWorldPosition(new THREE.Vector3()));
}

/**
 * Returns the client point over empty ground between and beyond the brushes.
 *
 * @param rig Test rig.
 * @returns Client point that hits no brush.
 */
function contextMenuEmptyPoint(rig: ContextMenuTestRig): PointerClientPoint {
  return objectDragTestClientPoint(rig.testViewport, new THREE.Vector3(0, 0, 6));
}

/**
 * Returns the labels of the open context menu rows.
 *
 * @returns Row labels, empty when no context menu is open.
 */
function contextMenuOpenLabels(): string[] {
  return [...document.body.querySelectorAll<HTMLElement>('[role="menu"] .editor-toolbar-dropdown-label')]
    .filter((label) => label.closest<HTMLElement>('[role="menu"]')?.style.display !== 'none')
    .map((label) => label.textContent ?? '');
}

afterEach(() => {
  contextMenuTestRig?.contextMenu.dispose();
  contextMenuTestRig?.bridge.uninstall();
  contextMenuTestRig = null;
  document.body.replaceChildren();
});

/**
 * Proves the right-click menu of the map views through the real editor input
 * path: a right click without dragging opens it with only the rows that apply,
 * selecting an unselected object first and keeping a selection that holds the
 * clicked object or a click on empty space; a right drag, a left click or a
 * busy tool opens nothing; a chosen row runs and closes the menu.
 */
describe('ObjectSelectContextMenu', () => {
  it('opens on a right click, selects the clicked unselected object and hides rows that do not apply', () => {
    const rig = contextMenuRigCreate();
    contextMenuClick(rig, contextMenuBrushPoint(rig, rig.firstBrush), 2);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.firstBrush]);
    expect(contextMenuOpenLabels()).toEqual(['Shown Command']);
  });

  it('keeps a selection that holds the clicked object', () => {
    const rig = contextMenuRigCreate();
    rig.selectionManager.setSelection([rig.firstBrush, rig.secondBrush], [rig.firstBrush, rig.secondBrush]);
    contextMenuClick(rig, contextMenuBrushPoint(rig, rig.secondBrush), 2);
    expect(new Set(rig.selectionManager.getAllSelectedObjectsAsArray())).toEqual(
      new Set([rig.firstBrush, rig.secondBrush]),
    );
    expect(contextMenuOpenLabels()).toEqual(['Shown Command']);
  });

  it('keeps the selection on a right click over empty space', () => {
    const rig = contextMenuRigCreate();
    rig.selectionManager.selectObject(rig.secondBrush);
    contextMenuClick(rig, contextMenuEmptyPoint(rig), 2);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.secondBrush]);
    expect(contextMenuOpenLabels()).toEqual(['Shown Command']);
  });

  it('opens nothing for a right drag, a left click or when the layout does not allow it', () => {
    const rig = contextMenuRigCreate();
    const point = contextMenuBrushPoint(rig, rig.firstBrush);
    contextMenuClick(rig, point, 2, GESTURE_SECONDARY_CLICK_DRAG_THRESHOLD_PX * 3);
    contextMenuClick(rig, point, 0);
    expect(contextMenuOpenLabels()).toEqual([]);
    rig.contextMenu.dispose();
    rig.bridge.uninstall();
    document.body.replaceChildren();
    const blockedRig = contextMenuRigCreate(false);
    contextMenuClick(blockedRig, contextMenuBrushPoint(blockedRig, blockedRig.firstBrush), 2);
    expect(contextMenuOpenLabels()).toEqual([]);
    expect(blockedRig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([]);
  });

  it('runs a chosen row and closes the menu', () => {
    const rig = contextMenuRigCreate();
    contextMenuClick(rig, contextMenuBrushPoint(rig, rig.firstBrush), 2);
    const row = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (button) => button.textContent?.includes('Shown Command') === true,
    );
    row?.click();
    expect(rig.runShown).toHaveBeenCalledOnce();
    expect(rig.runHidden).not.toHaveBeenCalled();
    expect(contextMenuOpenLabels()).toEqual([]);
  });
});
