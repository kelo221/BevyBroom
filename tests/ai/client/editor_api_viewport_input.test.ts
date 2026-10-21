import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { MCP_VIEWPORT_INPUT_TOOL_DEFINITIONS } from '@/ai/server/registry_mcp_tool_viewport_input.js';
import type { SelectionSummaryDto } from '@/ai/client/editor_api_types.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { shapeDrawRangeSnapOutward } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { editorTestServicesCreate } from '../../editor/editor_test_services.js';
import {
  objectDragTestControllerRigCreate,
  objectDragTestMeshTopCenter,
  type ObjectDragTestControllerRig,
} from '../../tools/object_drag/object_drag_test_controller.js';

/**
 * Converts a world point into the `{x, y, z}` argument the tools take.
 *
 * @param point World point.
 * @returns Plain point object.
 */
function pointArg(point: THREE.Vector3): { x: number; y: number; z: number } {
  return { x: point.x, y: point.y, z: point.z };
}

/**
 * Reads the selection a viewport input tool returned.
 *
 * @param result Tool result.
 * @returns Selection summary.
 */
function resultSelectionRead(result: McpToolResult): SelectionSummaryDto {
  return (result.data as { selection: SelectionSummaryDto }).selection;
}

/**
 * Applies object click selection like the editor: the nearest mesh under the
 * point is selected (Shift adds, Ctrl toggles), empty space deselects.
 *
 * @param rig Scene and selection.
 * @param clientX Click client X.
 * @param clientY Click client Y.
 * @param additive True to add to the selection.
 * @param toggle True to toggle the clicked mesh.
 */
function rigClickSelectionApply(
  rig: ObjectDragTestControllerRig,
  clientX: number,
  clientY: number,
  additive: boolean,
  toggle: boolean,
): void {
  const nearest = rig.testViewport.viewport.pickStackAtClientPoint(clientX, clientY)[0];
  if (nearest) {
    rig.selection.selectFromClick(nearest, additive, toggle);
    return;
  }
  if (!additive && !toggle) {
    rig.selection.clearSelection();
  }
}

/**
 * Proves viewport_drag and viewport_click drive the real editor input path with
 * pointer events: clicks select, dragging a selected object moves it, dragging
 * empty space with nothing selected draws a brush, and invalid arguments or
 * missing views fail clearly.
 */
describe('EditorApi viewport input tools', () => {
  let rig: ObjectDragTestControllerRig;
  let editor: EditorWindow;
  let bridge: EditorInputBridge;
  let api: EditorApi;
  const emptyGroundFrom = new THREE.Vector3(-0.7, 0, 3.3);
  const emptyGroundTo = new THREE.Vector3(1.9, 0, 5.1);

  beforeEach(() => {
    rig = objectDragTestControllerRigCreate();
    document.body.appendChild(rig.testViewport.element);
    editor = new EditorWindow();
    bridge = new EditorInputBridge(editor);
    editor.setServices(
      editorTestServicesCreate({
        beginObjectDragAtClientPoint: (press) => rig.controller.dragBegin(press),
        applyObjectClickSelectionAtClientPoint: (x, y, additive, toggle) =>
          rigClickSelectionApply(rig, x, y, additive, toggle),
      }),
    );
    editor.validateTools();
    editor.userSwitchToBoundsTool();
    bridge.install(document.body);
    bridge.setExclusiveViewportRoots([rig.testViewport.element]);
    const { host } = editorApiTestHostCreate({
      worldObject: rig.world,
      selectionManager: rig.selection,
      viewportsInteractiveRead: () => [rig.testViewport.source],
    });
    api = new EditorApi(host);
  });

  afterEach(() => {
    bridge.uninstall();
    rig.testViewport.element.remove();
    rig.controller.dispose();
  });

  it('selects with viewport_click, adds with Shift and clears on empty space', () => {
    const [first, second] = rig.meshes;
    if (!first || !second) {
      throw new Error('The rig must hold two meshes');
    }
    const clicked = api.invokeTool('viewport_click', {
      view: 'perspective',
      at: pointArg(objectDragTestMeshTopCenter(first)),
    });
    expect(clicked.ok).toBe(true);
    expect(resultSelectionRead(clicked).meshCount).toBe(1);
    expect(rig.selection.isObjectSelected(first)).toBe(true);
    api.invokeTool('viewport_click', {
      view: 'perspective',
      at: pointArg(objectDragTestMeshTopCenter(second)),
      keys: { shift: true },
    });
    expect(rig.selection.getSelectedObjectCount()).toBe(2);
    const cleared = api.invokeTool('viewport_click', { view: 'perspective', at: pointArg(emptyGroundFrom) });
    expect(resultSelectionRead(cleared).meshCount).toBe(0);
  });

  it('draws a grid-snapped brush with viewport_drag on empty space while nothing is selected', () => {
    const result = api.invokeTool('viewport_drag', {
      view: 'perspective',
      from: pointArg(emptyGroundFrom),
      to: pointArg(emptyGroundTo),
    });
    expect(result.ok).toBe(true);
    const selection = resultSelectionRead(result);
    expect(selection.brushIds.length).toBe(1);
    const brushMesh = rig.selection.getFirstSelectedObject();
    expect(brushMesh).not.toBeNull();
    const bounds = new THREE.Box3().setFromObject(brushMesh ?? new THREE.Object3D());
    const step = rig.gridSnap.getInterval();
    const expectedX = shapeDrawRangeSnapOutward(emptyGroundFrom.x, emptyGroundTo.x, step);
    expect(bounds.min.x).toBeCloseTo(expectedX.minimum, 4);
    expect(bounds.max.x).toBeCloseTo(expectedX.maximum, 4);
    expect(bounds.min.y).toBeCloseTo(emptyGroundFrom.y, 4);
    expect(rig.commandStack.getUndoCount()).toBe(1);
  });

  it('moves a selected object with viewport_drag', () => {
    const [first] = rig.meshes;
    if (!first) {
      throw new Error('The rig must hold a mesh');
    }
    rig.selection.selectObject(first);
    const start = first.position.clone();
    const pressPoint = objectDragTestMeshTopCenter(first);
    const offset = new THREE.Vector3(2 * rig.gridSnap.getInterval(), 0, -3 * rig.gridSnap.getInterval());
    const result = api.invokeTool('viewport_drag', {
      view: 'perspective',
      from: pointArg(pressPoint),
      to: pointArg(pressPoint.clone().add(offset)),
      steps: 3,
    });
    expect(result.ok).toBe(true);
    expect(first.position.distanceTo(start.clone().add(offset))).toBeLessThan(1e-4);
  });

  it('changes nothing when dragging empty space while something is selected', () => {
    const [first] = rig.meshes;
    if (!first) {
      throw new Error('The rig must hold a mesh');
    }
    rig.selection.selectObject(first);
    const childCountBefore = rig.world.children.length;
    api.invokeTool('viewport_drag', {
      view: 'perspective',
      from: pointArg(emptyGroundFrom),
      to: pointArg(emptyGroundTo),
    });
    expect(rig.world.children.length).toBe(childCountBefore);
    expect(rig.selection.getAllSelectedObjectsAsArray()).toEqual([first]);
  });

  it('fails clearly for invalid arguments and views that are not visible', () => {
    const from = pointArg(emptyGroundFrom);
    const to = pointArg(emptyGroundTo);
    expect(api.invokeTool('viewport_drag', { view: 'diagonal', from, to }).ok).toBe(false);
    expect(api.invokeTool('viewport_drag', { view: 'perspective', from: { x: 1 }, to }).ok).toBe(false);
    expect(api.invokeTool('viewport_drag', { view: 'perspective', from, to, steps: 0 }).ok).toBe(false);
    expect(api.invokeTool('viewport_drag', { view: 'perspective', from, to, keys: { ctrl: 'yes' } }).ok).toBe(false);
    const missingView = api.invokeTool('viewport_click', { view: 'top', at: from });
    expect(missingView.ok).toBe(false);
    expect(missingView.message).toContain('top');
    expect(rig.commandStack.canUndo()).toBe(false);
  });

  it('publishes both tools with their required arguments', () => {
    const required = Object.fromEntries(
      MCP_VIEWPORT_INPUT_TOOL_DEFINITIONS.map((definition) => [definition.name, definition.inputSchema['required']]),
    );
    expect(required['viewport_drag']).toEqual(['view', 'from', 'to']);
    expect(required['viewport_click']).toEqual(['view', 'at']);
  });
});
