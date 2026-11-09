import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { EditorWindow } from '@/editor/window/editor_window.js';
import {
  PolygonTool,
  POLYGON_TOOL_STATUS_DRAG_IGNORED,
  POLYGON_TOOL_STATUS_PLACE_FAILED,
  POLYGON_TOOL_STATUS_TOO_FEW_POINTS,
} from '@/editor/tools/polygon/polygon_tool.js';
import { POLYGON_CLICK_JITTER_TOLERANCE_PX } from '@/editor/tools/polygon/polygon_click_gesture.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { PolygonSketchProjector } from '@/tools/polygon/sketch/polygon_sketch_projector.js';
import { PolygonSketchFrame } from '@/tools/polygon/sketch/polygon_sketch_frame.js';
import { PolygonBrushCommitter } from '@/tools/polygon/polygon_brush_committer.js';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { editorTestServicesCreate } from '../../editor_test_services.js';
import {
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from '../../../tools/object_drag/object_drag_test_viewport.js';

/** Editor, viewport and world a Polygon tool test drives. */
interface PolygonToolFixture {
  editor: EditorWindow;
  topViewport: ObjectDragTestViewport;
  model: SolidModel;
  status: ReturnType<typeof vi.fn<(message: string) => void>>;
}

/**
 * Builds an editor with the Polygon tool active over a top view whose clicks
 * project through the real sketch projector and commit through the real brush
 * committer.
 *
 * @returns Fixture.
 */
function polygonToolFixtureCreate(): PolygonToolFixture {
  const topViewport = objectDragTestViewportCreate(ViewportKind.TOP);
  const model = new SolidModel('World');
  polygonToolStateWire(topViewport, polygonToolCommitterCreate(model));
  const status = vi.fn<(message: string) => void>();
  const editor = new EditorWindow();
  editor.setServices(editorTestServicesCreate({ setStatusMessage: status }));
  editor.switchTool(new PolygonTool());
  return { editor, topViewport, model, status };
}

/**
 * Builds a brush committer that inserts into a model placed in a fresh world.
 *
 * @param model Model the brushes go into.
 * @returns Committer.
 */
function polygonToolCommitterCreate(model: SolidModel): PolygonBrushCommitter {
  const world = new THREE.Group();
  world.add(model.root);
  return new PolygonBrushCommitter({
    commandStack: new CommandStack(16),
    worldObject: world,
    selectObject: () => true,
    selectObjects: () => true,
    activeModelResolve: () => model,
    brushInsertParentResolve: (target) => target.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
}

/**
 * Wires the Polygon state to project clicks through a view and commit through a
 * committer, and turns the tool on.
 *
 * @param topViewport View the clicks project through.
 * @param committer Committer the outline is extruded through.
 */
function polygonToolStateWire(topViewport: ObjectDragTestViewport, committer: PolygonBrushCommitter): void {
  const projector = new PolygonSketchProjector({
    viewportAtClientPoint: () => topViewport.source,
    gridSnap: new GridSnap(false, 1),
  });
  const state = getStatePolygonTool();
  state.clientPointProjectorWrite((x, y, lockedFrame, depth) => projector.project(x, y, lockedFrame, depth));
  state.commitDelegateWrite((recipe) => committer.commitRecipe(recipe));
  state.toolActiveWrite(true);
}

/**
 * Presses and releases the left button, moving the pointer between the two.
 *
 * @param editor Editor window.
 * @param press Client point of the press.
 * @param release Client point of the release.
 */
function leftClick(editor: EditorWindow, press: THREE.Vector2, release: THREE.Vector2): void {
  editor.lastPointerClientX = press.x;
  editor.lastPointerClientY = press.y;
  editor.onMouseDown(0);
  editor.lastPointerClientX = release.x;
  editor.lastPointerClientY = release.y;
  editor.onGlobalMouseDrag(0, new THREE.Vector2(), new THREE.Vector2());
  editor.onGlobalMouseUp(0);
}

/**
 * Sends a key press through the editor window.
 *
 * @param editor Editor window.
 * @param code KeyboardEvent.code of the key.
 * @returns True when the editor used the key.
 */
function keyPress(editor: EditorWindow, code: string): boolean {
  return editor.onKeyDown(code, new KeyboardEvent('keydown', { code }));
}

/**
 * Clicks with a small jitter over a world point of the top view.
 *
 * @param fixture Test fixture.
 * @param worldPoint World point to click.
 */
function jitteredClickAtWorld(fixture: PolygonToolFixture, worldPoint: THREE.Vector3): void {
  const client = objectDragTestClientPoint(fixture.topViewport, worldPoint);
  const press = new THREE.Vector2(client.clientX, client.clientY);
  const jitter = POLYGON_CLICK_JITTER_TOLERANCE_PX / 2;
  leftClick(fixture.editor, press, press.clone().add(new THREE.Vector2(jitter, -jitter / 2)));
}

/**
 * Returns the world points of the placed outline.
 *
 * @returns World points.
 */
function placedWorldPointsRead(): THREE.Vector3[] {
  const state = getStatePolygonTool();
  return state.verticesRead().map((vertex) => PolygonSketchFrame.worldPointAt(state.previewFrameRead(), vertex, 0));
}

/** World corners of a square outline on the floor. */
const POLYGON_TOOL_TEST_SQUARE = [
  new THREE.Vector3(-2, 0, -2),
  new THREE.Vector3(2, 0, -2),
  new THREE.Vector3(2, 0, 2),
  new THREE.Vector3(-2, 0, 2),
];

describe('PolygonTool', () => {
  afterEach(() => {
    const state = getStatePolygonTool();
    state.toolActiveWrite(false);
    state.clientPointProjectorWrite(null);
    state.commitDelegateWrite(null);
  });

  it('places points where jittery clicks pressed in a 2D view', () => {
    const fixture = polygonToolFixtureCreate();
    POLYGON_TOOL_TEST_SQUARE.slice(0, 2).forEach((corner) => jitteredClickAtWorld(fixture, corner));
    const placed = placedWorldPointsRead();
    expect(placed).toHaveLength(2);
    placed.forEach((point, index) => {
      expect(point.distanceTo(POLYGON_TOOL_TEST_SQUARE[index] ?? new THREE.Vector3())).toBeLessThan(1e-3);
    });
  });

  it('ignores a press dragged past the click tolerance and says why', () => {
    const fixture = polygonToolFixtureCreate();
    const press = new THREE.Vector2(200, 200);
    leftClick(fixture.editor, press, press.clone().addScalar(POLYGON_CLICK_JITTER_TOLERANCE_PX * 2));
    expect(getStatePolygonTool().verticesRead()).toHaveLength(0);
    expect(fixture.status).toHaveBeenLastCalledWith(POLYGON_TOOL_STATUS_DRAG_IGNORED);
  });

  it('reports a click that misses the sketch plane', () => {
    const fixture = polygonToolFixtureCreate();
    getStatePolygonTool().clientPointProjectorWrite(() => null);
    const press = new THREE.Vector2(100, 100);
    leftClick(fixture.editor, press, press);
    expect(fixture.status).toHaveBeenLastCalledWith(POLYGON_TOOL_STATUS_PLACE_FAILED);
  });

  it('extrudes the outline into a brush on Enter and clears it', () => {
    const fixture = polygonToolFixtureCreate();
    POLYGON_TOOL_TEST_SQUARE.forEach((corner) => jitteredClickAtWorld(fixture, corner));
    expect(keyPress(fixture.editor, 'Enter')).toBe(true);
    const brushes: THREE.Mesh[] = [];
    fixture.model.root.traverse((object) => {
      if (object instanceof THREE.Mesh) brushes.push(object);
    });
    expect(brushes.length).toBeGreaterThanOrEqual(1);
    const bounds = new THREE.Box3();
    brushes.forEach((brush) => bounds.expandByObject(brush));
    const outlineBounds = new THREE.Box3().setFromPoints(POLYGON_TOOL_TEST_SQUARE);
    expect(bounds.min.x).toBeCloseTo(outlineBounds.min.x, 3);
    expect(bounds.max.z).toBeCloseTo(outlineBounds.max.z, 3);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(getStatePolygonTool().extrusionDepthRead(), 3);
    expect(getStatePolygonTool().verticesRead()).toHaveLength(0);
  });

  it('refuses Enter with fewer than three points', () => {
    const fixture = polygonToolFixtureCreate();
    POLYGON_TOOL_TEST_SQUARE.slice(0, 2).forEach((corner) => jitteredClickAtWorld(fixture, corner));
    keyPress(fixture.editor, 'Enter');
    expect(fixture.status).toHaveBeenLastCalledWith(POLYGON_TOOL_STATUS_TOO_FEW_POINTS);
    expect(getStatePolygonTool().verticesRead()).toHaveLength(2);
  });

  it('removes the last point on Backspace and clears the outline on Escape', () => {
    const fixture = polygonToolFixtureCreate();
    POLYGON_TOOL_TEST_SQUARE.slice(0, 3).forEach((corner) => jitteredClickAtWorld(fixture, corner));
    keyPress(fixture.editor, 'Backspace');
    expect(getStatePolygonTool().verticesRead()).toHaveLength(2);
    expect(keyPress(fixture.editor, 'Escape')).toBe(true);
    expect(getStatePolygonTool().verticesRead()).toHaveLength(0);
  });

  it('moves the rubber-band cursor with the pointer and hides it when the tool is left', () => {
    const fixture = polygonToolFixtureCreate();
    const client = objectDragTestClientPoint(fixture.topViewport, new THREE.Vector3(1, 0, 1));
    fixture.editor.lastPointerClientX = client.clientX;
    fixture.editor.lastPointerClientY = client.clientY;
    fixture.editor.onMouseMove(new THREE.Vector2(), new THREE.Vector2());
    expect(getStatePolygonTool().cursorPointRead()).not.toBeNull();
    fixture.editor.userSwitchToBoundsTool();
    expect(getStatePolygonTool().cursorPointRead()).toBeNull();
    expect(fixture.editor.activeTool).not.toBeInstanceOf(PolygonTool);
  });

  it('turns the Polygon state off and tells its listener when the editor switches away', () => {
    const fixture = polygonToolFixtureCreate();
    const polygonTool = fixture.editor.activeTool;
    expect(polygonTool).toBeInstanceOf(PolygonTool);
    const onLeft = vi.fn<() => void>();
    if (polygonTool instanceof PolygonTool) {
      polygonTool.leftListenerWrite(onLeft);
    }
    fixture.editor.userSwitchToBoundsTool();
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(getStatePolygonTool().toolActiveRead()).toBe(false);
  });

  it('never holds busy input so other tools can always be chosen', () => {
    const fixture = polygonToolFixtureCreate();
    const press = new THREE.Vector2(150, 150);
    fixture.editor.lastPointerClientX = press.x;
    fixture.editor.lastPointerClientY = press.y;
    fixture.editor.onMouseDown(0);
    expect(fixture.editor.isActiveEventReceiverBusy).toBe(false);
  });
});
