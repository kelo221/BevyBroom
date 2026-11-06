import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { entityTransformScaleAllowedAll } from '@/entity/scale/entity_scale_allowed.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import { orderObjectPickStackForViewport } from '@/selection/object/selection_pick_order_2d.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import { ObjectSelectDoubleClickNativeListener } from '@/tools/object_select/object_select_double_click_native_listener.js';
import { ObjectSelectDoubleClickProperties } from '@/tools/object_select/object_select_double_click_properties.js';
import { objectSelectDoubleClickToolReady } from '@/tools/object_select/object_select_double_click_tool_ready.js';
import { DialogObjectProperties } from '@/ui/object_properties/dialog_object_properties.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { editorTestServicesCreate } from '../../editor/editor_test_services.js';
import { testClassesInstall } from '../../game_entity/game_entity_test_classes.js';
import {
  objectDragTestBoxMeshCreate,
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from '../object_drag/object_drag_test_viewport.js';
import type { PointerClientPoint } from '@/utils/pointer_client_project.js';

/** Scene, editor and dialog one double-click test works with. */
interface DoubleClickTestRig {
  readonly editor: EditorWindow;
  readonly bridge: EditorInputBridge;
  readonly nativeListener: ObjectSelectDoubleClickNativeListener;
  readonly testViewport: ObjectDragTestViewport;
  readonly selectionManager: ManagerSelection;
  readonly dialog: DialogObjectProperties;
  readonly objectPropertiesOpen: ReturnType<typeof vi.fn>;
  readonly brushMesh: THREE.Mesh;
  readonly door: THREE.Group;
  readonly doorMarker: THREE.Mesh;
  readonly light: THREE.Group;
  readonly lightMarker: THREE.Mesh;
  readonly beginObjectDrag: ReturnType<typeof vi.fn>;
  readonly faceSelectPointerDown: ReturnType<typeof vi.fn>;
}

/** Scene objects of a rig. */
interface DoubleClickTestScene {
  readonly worldObject: THREE.Group;
  readonly brushMesh: THREE.Mesh;
  readonly door: THREE.Group;
  readonly doorMarker: THREE.Mesh;
  readonly light: THREE.Group;
  readonly lightMarker: THREE.Mesh;
}

/** Rig of the running test, torn down after it. */
let doubleClickTestRig: DoubleClickTestRig | null = null;

/**
 * Returns the meshes under a client point of the test viewport, nearest first.
 *
 * @param testViewport Test viewport.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @returns Picked meshes.
 */
function testPickStackRead(testViewport: ObjectDragTestViewport, clientX: number, clientY: number): THREE.Mesh[] {
  return testViewport.source.getObjectPickStack({ clientX, clientY } as MouseEvent);
}

/**
 * Applies a plain, Shift or Ctrl click selection the way a 2D view does: the
 * first mesh in reverse outliner order wins, and a plain click over empty space
 * clears the selection.
 *
 * @param rigParts Viewport and selection the click acts on.
 * @param rigParts.testViewport Test viewport.
 * @param rigParts.selectionManager Object selection.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @param additive True when Shift is held.
 * @param toggle True when Ctrl is held.
 */
function testClickSelectionApply(
  rigParts: { testViewport: ObjectDragTestViewport; selectionManager: ManagerSelection },
  clientX: number,
  clientY: number,
  additive: boolean,
  toggle: boolean,
): void {
  const pickStack = testPickStackRead(rigParts.testViewport, clientX, clientY);
  const pickedMesh = orderObjectPickStackForViewport(pickStack, true)[0];
  if (pickedMesh) {
    rigParts.selectionManager.selectFromClick(pickedMesh, additive, toggle);
  } else if (!additive && !toggle) {
    rigParts.selectionManager.clearSelection();
  }
}

/**
 * Creates the Object Properties dialog over a selection.
 *
 * @param selectionManager Object selection.
 * @param worldObject Scene root.
 * @returns Hidden dialog.
 */
function testDialogCreate(selectionManager: ManagerSelection, worldObject: THREE.Group): DialogObjectProperties {
  return new DialogObjectProperties(document.body, {
    selectionManager,
    commandStack: new CommandStack(64),
    worldObject,
    afterWorldMutation: () => {},
    afterTransformCommit: () => {},
    propertiesPanelRead: () => null,
    selectionFrame: () => {},
  });
}

/**
 * Returns an entity marker, failing the test when the entity has none.
 *
 * @param marker Marker mesh, or null.
 * @returns The marker mesh.
 */
function testMarkerRequire(marker: THREE.Mesh | null): THREE.Mesh {
  if (!marker) {
    throw new Error('entity has no marker mesh');
  }
  return marker;
}

/**
 * Places an entity owner beside the brush, a number of brush widths away.
 *
 * @param worldObject Scene root.
 * @param owner Entity owner to place.
 * @param brushMesh Brush the entity is placed beside.
 * @param brushWidths Signed distance from the brush center in brush widths.
 */
function testEntityPlaceBesideBrush(
  worldObject: THREE.Group,
  owner: THREE.Group,
  brushMesh: THREE.Mesh,
  brushWidths: number,
): void {
  const brushSize = new THREE.Box3().setFromObject(brushMesh).getSize(new THREE.Vector3());
  owner.position.set(brushMesh.position.x + brushSize.x * brushWidths, 0, 0);
  worldObject.add(owner);
  owner.updateMatrixWorld(true);
}

/**
 * Creates a brush with a door entity on one side and a point light on the
 * other.
 *
 * @returns Scene objects.
 */
function testSceneCreate(): DoubleClickTestScene {
  const worldObject = new THREE.Group();
  const brushMesh = objectDragTestBoxMeshCreate(worldObject, new THREE.Vector3(2, 2, 2), new THREE.Vector3());
  const door = GameEntityOwner.createDefault('door_main');
  testEntityPlaceBesideBrush(worldObject, door, brushMesh, 3);
  const light = LightOwner.createDefault('Lamp', 'point');
  testEntityPlaceBesideBrush(worldObject, light, brushMesh, -3);
  return {
    worldObject,
    brushMesh,
    door,
    doorMarker: testMarkerRequire(GameEntityOwner.markerOf(door)),
    light,
    lightMarker: testMarkerRequire(LightOwner.markerOf(light)),
  };
}

/**
 * Builds services that pick and select through the test viewport, report the
 * selection count and hand click releases to the double-click handling.
 *
 * @param rigParts Viewport, selection and double-click handling.
 * @param rigParts.testViewport Test viewport.
 * @param rigParts.selectionManager Object selection.
 * @param rigParts.doubleClick Double-click handling under test.
 * @param overrides Service members a test replaces.
 * @returns Editor services.
 */
function testServicesCreate(
  rigParts: {
    testViewport: ObjectDragTestViewport;
    selectionManager: ManagerSelection;
    doubleClick: ObjectSelectDoubleClickProperties;
  },
  overrides: Partial<EditorServices>,
): EditorServices {
  return editorTestServicesCreate({
    getSelectedCount: () => rigParts.selectionManager.getSelectedObjectCount(),
    pickObjectStackAtClientPoint: (clientX, clientY) => testPickStackRead(rigParts.testViewport, clientX, clientY),
    applyObjectClickSelectionAtClientPoint: (clientX, clientY, additive, toggle) =>
      testClickSelectionApply(rigParts, clientX, clientY, additive, toggle),
    objectClickReleaseDoubleClickHandle: (clientX, clientY, isModifierHeld) =>
      rigParts.doubleClick.clickRelease(clientX, clientY, isModifierHeld),
    ...overrides,
  });
}

/**
 * Creates the double-click handling the way the layout does: it picks through
 * the test viewport, opens the dialog and asks the active tool whether it is
 * idle.
 *
 * @param editor Object tool editor.
 * @param testViewport Test viewport.
 * @param selectionManager Object selection.
 * @param objectPropertiesOpen Opens the dialog.
 * @returns Double-click handling.
 */
function testDoubleClickCreate(
  editor: EditorWindow,
  testViewport: ObjectDragTestViewport,
  selectionManager: ManagerSelection,
  objectPropertiesOpen: () => void,
): ObjectSelectDoubleClickProperties {
  return new ObjectSelectDoubleClickProperties({
    selectionManager,
    pickObjectStackAtClientPoint: (clientX, clientY) => testPickStackRead(testViewport, clientX, clientY),
    objectPropertiesOpen,
    isDoubleClickAllowed: () => objectSelectDoubleClickToolReady(editor.activeTool),
  });
}

/**
 * Creates a top view over the scene's selectable meshes, the object tool editor
 * routed through the real input bridge, the browser double-click listener and
 * the Object Properties dialog the double-click opens.
 *
 * @param overrides Service members a test replaces.
 * @param viewportKind 2D view the rig looks through.
 * @returns Test rig.
 */
function doubleClickRigCreate(
  overrides: Partial<EditorServices> = {},
  viewportKind: ViewportKind = ViewportKind.TOP,
): DoubleClickTestRig {
  const scene = testSceneCreate();
  const testViewport = objectDragTestViewportCreate(viewportKind, selectableMeshesCollect(scene.worldObject));
  const selectionManager = new ManagerSelection();
  const dialog = testDialogCreate(selectionManager, scene.worldObject);
  const objectPropertiesOpen = vi.fn(() => dialog.open());
  const editor = new EditorWindow();
  const doubleClick = testDoubleClickCreate(editor, testViewport, selectionManager, objectPropertiesOpen);
  const beginObjectDrag = vi.fn(() => null);
  const faceSelectPointerDown = vi.fn(() => true);
  editor.setServices(
    testServicesCreate(
      { testViewport, selectionManager, doubleClick },
      {
        beginObjectDragAtClientPoint: beginObjectDrag,
        beginFaceSelectPointerDown: faceSelectPointerDown,
        ...overrides,
      },
    ),
  );
  const bridge = doubleClickBridgeInstall(editor, testViewport);
  const nativeListener = new ObjectSelectDoubleClickNativeListener(document, doubleClick);
  doubleClickTestRig = {
    ...scene,
    editor,
    bridge,
    nativeListener,
    testViewport,
    selectionManager,
    dialog,
    objectPropertiesOpen,
    beginObjectDrag,
    faceSelectPointerDown,
  };
  return doubleClickTestRig;
}

/**
 * Activates the Bounds tool and routes the test viewport's pointer events
 * through a real input bridge.
 *
 * @param editor Object tool editor.
 * @param testViewport Test viewport.
 * @returns Installed input bridge.
 */
function doubleClickBridgeInstall(editor: EditorWindow, testViewport: ObjectDragTestViewport): EditorInputBridge {
  editor.validateTools();
  editor.userSwitchToBoundsTool();
  document.body.appendChild(testViewport.element);
  const bridge = new EditorInputBridge(editor);
  bridge.install(document.body);
  bridge.setExclusiveViewportRoots([testViewport.element]);
  return bridge;
}

/**
 * Dispatches a left-button press and release in place on the test viewport.
 *
 * @param rig Test rig.
 * @param point Client point clicked.
 * @param keys Held modifier keys.
 * @param keys.shiftKey True when Shift is held.
 */
function testClick(rig: DoubleClickTestRig, point: PointerClientPoint, keys: { shiftKey?: boolean } = {}): void {
  for (const type of ['pointerdown', 'pointerup'] as const) {
    rig.testViewport.element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: point.clientX,
        clientY: point.clientY,
        button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
        shiftKey: keys.shiftKey === true,
      }),
    );
  }
}

/**
 * Dispatches the browser's double-click event on the test viewport.
 *
 * @param rig Test rig.
 * @param point Client point double-clicked.
 * @param keys Held modifier keys.
 * @param keys.shiftKey True when Shift is held.
 */
function testBrowserDoubleClickEvent(
  rig: DoubleClickTestRig,
  point: PointerClientPoint,
  keys: { shiftKey?: boolean } = {},
): void {
  rig.testViewport.element.dispatchEvent(
    new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: point.clientX,
      clientY: point.clientY,
      button: 0,
      detail: 2,
      shiftKey: keys.shiftKey === true,
    }),
  );
}

/**
 * Double-clicks like a mouse does in a browser: two presses and releases in
 * place, then the double-click event.
 *
 * @param rig Test rig.
 * @param point Client point double-clicked.
 * @param keys Held modifier keys.
 * @param keys.shiftKey True when Shift is held.
 */
function testDoubleClick(rig: DoubleClickTestRig, point: PointerClientPoint, keys: { shiftKey?: boolean } = {}): void {
  testClick(rig, point, keys);
  testClick(rig, point, keys);
  testBrowserDoubleClickEvent(rig, point, keys);
}

/**
 * Double-clicks like input automation that sends a single press with a click
 * count of two: one press and release, then the double-click event.
 *
 * @param rig Test rig.
 * @param point Client point double-clicked.
 */
function testDoubleClickSinglePress(rig: DoubleClickTestRig, point: PointerClientPoint): void {
  testClick(rig, point);
  testBrowserDoubleClickEvent(rig, point);
}

/**
 * Returns the client point over the center of an object.
 *
 * @param rig Test rig.
 * @param object Object to point at.
 * @returns Client point.
 */
function testPointOver(rig: DoubleClickTestRig, object: THREE.Object3D): PointerClientPoint {
  const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  return objectDragTestClientPoint(rig.testViewport, center);
}

/**
 * Returns a client point inside the view where no object is.
 *
 * @param rig Test rig.
 * @returns Client point over empty space.
 */
function testPointOverEmptySpace(rig: DoubleClickTestRig): PointerClientPoint {
  const brushBounds = new THREE.Box3().setFromObject(rig.brushMesh);
  const emptyPoint = new THREE.Vector3(0, 0, brushBounds.max.z + brushBounds.getSize(new THREE.Vector3()).z * 2);
  return objectDragTestClientPoint(rig.testViewport, emptyPoint);
}

/**
 * Double-clicking an object with the object tool opens Object Properties on it:
 * the dialog targets the hit entity, a multi-selection containing the hit
 * object stays whole, empty space and Shift double-clicks open nothing, the
 * face and Entity tools keep their own clicks, and the presses never start an
 * object drag. The browser's double-click event opens the dialog when the tool
 * saw only one click or the presses went to gizmo handles, and never opens it a
 * second time after the tool's clicks already did.
 */
describe('ObjectSelectDoubleClickProperties through the object tool', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    doubleClickTestRig?.bridge.uninstall();
    doubleClickTestRig?.nativeListener.dispose();
    doubleClickTestRig?.dialog.dispose();
    doubleClickTestRig = null;
    getStateEntityPlace().toolActiveWrite(false);
    uninstall();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('opens Object Properties once on a double-clicked entity with the entity as its target', () => {
    const rig = doubleClickRigCreate();
    const doorPoint = testPointOver(rig, rig.door);
    expect(testPickStackRead(rig.testViewport, doorPoint.clientX, doorPoint.clientY)).toContain(rig.doorMarker);
    testDoubleClick(rig, doorPoint);
    expect(rig.dialog.isOpen()).toBe(true);
    expect(rig.objectPropertiesOpen).toHaveBeenCalledTimes(1);
    expect(rig.dialog.editedObjectsRead()).toEqual([rig.door]);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.doorMarker]);
  });

  it('opens Object Properties on an already selected light', () => {
    const rig = doubleClickRigCreate();
    const lightPoint = testPointOver(rig, rig.lightMarker);
    testClick(rig, lightPoint);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.lightMarker]);
    testDoubleClick(rig, lightPoint);
    expect(rig.objectPropertiesOpen).toHaveBeenCalledTimes(1);
    expect(rig.dialog.editedObjectsRead()).toEqual([rig.light]);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.lightMarker]);
  });

  it('opens Object Properties from the browser double-click when the tool saw a single press', () => {
    const rig = doubleClickRigCreate();
    testDoubleClickSinglePress(rig, testPointOver(rig, rig.lightMarker));
    expect(rig.objectPropertiesOpen).toHaveBeenCalledTimes(1);
    expect(rig.dialog.editedObjectsRead()).toEqual([rig.light]);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.lightMarker]);
  });

  it('opens Object Properties when the gizmo handles of Rotate mode take both presses', () => {
    const probeGizmo = vi.fn(() => true);
    const beginGizmoDrag = vi.fn(() => true);
    const rig = doubleClickRigCreate({
      probePermanentGizmoUnderPointer: probeGizmo,
      tryBeginPermanentGizmoDragFromEditorPointer: beginGizmoDrag,
    });
    rig.selectionManager.selectObject(rig.lightMarker);
    rig.editor.userSwitchToRotateTool();
    testDoubleClick(rig, testPointOver(rig, rig.lightMarker));
    expect(beginGizmoDrag).toHaveBeenCalledTimes(2);
    expect(rig.objectPropertiesOpen).toHaveBeenCalledTimes(1);
    expect(rig.dialog.editedObjectsRead()).toEqual([rig.light]);
  });

  it('selects the marker of a light clicked in the front view, so the selection keeps no scale', () => {
    const rig = doubleClickRigCreate({}, ViewportKind.FRONT);
    testClick(rig, testPointOver(rig, rig.lightMarker));
    const selectedMeshes = rig.selectionManager.getAllSelectedObjectsAsArray();
    expect(selectedMeshes).toEqual([rig.lightMarker]);
    expect(entityTransformScaleAllowedAll(selectedMeshes)).toBe(false);
  });

  it('single-selects an unselected double-clicked object over an earlier selection', () => {
    const rig = doubleClickRigCreate();
    rig.selectionManager.selectObject(rig.brushMesh);
    testDoubleClick(rig, testPointOver(rig, rig.door));
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.doorMarker]);
    expect(rig.dialog.editedObjectsRead()).toEqual([rig.door]);
  });

  it('opens Object Properties on the whole multi-selection holding the double-clicked object', () => {
    const rig = doubleClickRigCreate();
    rig.selectionManager.setSelection([rig.brushMesh, rig.doorMarker]);
    const selectionBefore = rig.selectionManager.getInspectorObjects();
    testDoubleClick(rig, testPointOver(rig, rig.door));
    expect(rig.dialog.isOpen()).toBe(true);
    expect(new Set(rig.selectionManager.getAllSelectedObjectsAsArray())).toEqual(
      new Set([rig.brushMesh, rig.doorMarker]),
    );
    expect(new Set(rig.dialog.editedObjectsRead())).toEqual(new Set(selectionBefore));
    expect(rig.dialog.editedObjectsRead()).toHaveLength(2);
  });

  it('opens nothing on a double-click over empty space', () => {
    const rig = doubleClickRigCreate();
    rig.selectionManager.selectObject(rig.brushMesh);
    testDoubleClick(rig, testPointOverEmptySpace(rig));
    expect(rig.dialog.isOpen()).toBe(false);
    expect(rig.selectionManager.getSelectedObjectCount()).toBe(0);
  });

  it('keeps Shift double-clicks as plain additive clicks', () => {
    const rig = doubleClickRigCreate();
    testDoubleClick(rig, testPointOver(rig, rig.door), { shiftKey: true });
    expect(rig.dialog.isOpen()).toBe(false);
    expect(rig.selectionManager.getAllSelectedObjectsAsArray()).toEqual([rig.doorMarker]);
  });

  it('never starts an object drag from the presses of a double-click', () => {
    const rig = doubleClickRigCreate();
    const doorPointBefore = rig.door.getWorldPosition(new THREE.Vector3());
    testDoubleClick(rig, testPointOver(rig, rig.door));
    expect(rig.beginObjectDrag).not.toHaveBeenCalled();
    expect(rig.door.getWorldPosition(new THREE.Vector3()).equals(doorPointBefore)).toBe(true);
  });

  it('leaves the double-click to the face tool while face selection is active', () => {
    const rig = doubleClickRigCreate();
    rig.editor.userSwitchToFaceSelectTool();
    testDoubleClick(rig, testPointOver(rig, rig.brushMesh));
    expect(rig.faceSelectPointerDown).toHaveBeenCalledTimes(2);
    expect(rig.dialog.isOpen()).toBe(false);
    expect(rig.selectionManager.getSelectedObjectCount()).toBe(0);
  });

  it('leaves the double-click to the Entity tool while it places entities', () => {
    const rig = doubleClickRigCreate();
    rig.selectionManager.selectObject(rig.lightMarker);
    getStateEntityPlace().toolActiveWrite(true);
    testBrowserDoubleClickEvent(rig, testPointOver(rig, rig.lightMarker));
    expect(rig.objectPropertiesOpen).not.toHaveBeenCalled();
  });
});
