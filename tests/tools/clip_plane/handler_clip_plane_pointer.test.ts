import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { ClipKeepMode } from '@/tools/clip_plane/clip_keep_mode.js';
import { CLIP_LINE_DRAG_THRESHOLD_PIXELS } from '@/tools/clip_plane/clip_plane_line_drag.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { ManagerInput } from '@/input/manager_input.js';

/** Size in CSS pixels of the square test pane. */
const POINTER_TEST_PANE_PIXELS = 400;

/** Half height in meters of the orthographic test view. */
const POINTER_TEST_VIEW_HALF_METERS = 5;

/** Depth of the selected box center along the view axis. */
const POINTER_TEST_TARGET_DEPTH = -3;

/**
 * Creates a pick element whose bounds are the square test pane.
 *
 * @returns Pick element.
 */
function paneElementCreate(): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      right: POINTER_TEST_PANE_PIXELS,
      bottom: POINTER_TEST_PANE_PIXELS,
      width: POINTER_TEST_PANE_PIXELS,
      height: POINTER_TEST_PANE_PIXELS,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  return element;
}

/**
 * Creates a front 2D view camera looking down -Z.
 *
 * @returns Orthographic camera.
 */
function frontCameraCreate(): THREE.OrthographicCamera {
  const half = POINTER_TEST_VIEW_HALF_METERS;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Returns the client position of a world X/Y point in the front test view.
 *
 * @param x World X.
 * @param y World Y.
 * @returns Client position.
 */
function frontClientPoint(x: number, y: number): { clientX: number; clientY: number } {
  const pixelsPerMeter = POINTER_TEST_PANE_PIXELS / (POINTER_TEST_VIEW_HALF_METERS * 2);
  return {
    clientX: POINTER_TEST_PANE_PIXELS / 2 + x * pixelsPerMeter,
    clientY: POINTER_TEST_PANE_PIXELS / 2 - y * pixelsPerMeter,
  };
}

/**
 * Builds a pointer event at a world X/Y point in the front test view.
 *
 * @param handler Clip handler (builds the event shape the tool uses).
 * @param x World X.
 * @param y World Y.
 * @returns Mouse event.
 */
function frontPointerEvent(handler: HandlerClipPlane, x: number, y: number): MouseEvent {
  const client = frontClientPoint(x, y);
  return handler.createSyntheticMouseEvent(client.clientX, client.clientY, false);
}

/**
 * Builds a key-down event.
 *
 * @param code Key code.
 * @param key Produced key.
 * @param options Modifier and repeat flags.
 * @returns Keyboard event.
 */
function keyEvent(code: string, key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, key, cancelable: true, ...options });
}

/**
 * Proves the clip handler's pointer and key behavior: line drags in empty 2D
 * space, the pointer preview of point 2, marker grabs, keep-side keys and
 * applying with Enter.
 */
describe('HandlerClipPlane pointer and keys', () => {
  let worldObject: THREE.Group;
  let selectionManager: ManagerSelection;
  let clipPlaneTool: ToolClipPlane;
  let handler: HandlerClipPlane;
  let target: THREE.Mesh;
  let camera: THREE.OrthographicCamera;
  let pane: HTMLElement;

  beforeEach(() => {
    worldObject = new THREE.Group();
    target = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    target.position.set(0, 0, POINTER_TEST_TARGET_DEPTH);
    worldObject.add(target);
    worldObject.updateMatrixWorld(true);
    selectionManager = new ManagerSelection();
    selectionManager.selectObject(target);
    clipPlaneTool = new ToolClipPlane();
    const keyboard = new HandlerKeyboardShortcut(new ManagerInput());
    handler = new HandlerClipPlane({
      worldObject,
      commandStack: new CommandStack(32),
      selectionManager,
      gridSnap: new GridSnap(false, 1),
      clipPlaneTool,
      modalToolSessionRegistry: { runWithSelectionEndSuppressed: (work: () => void) => work() } as never,
      showStatusMessage: vi.fn(),
      syncPrimitivesToViewports: vi.fn(),
      refreshOutliner: vi.fn(),
      updateShadingMeshes: vi.fn(),
      onToolStateChanged: vi.fn(),
      keyboardShortcutMatches: (event, action) => keyboard.shortcutMatches(event, action),
    });
    camera = frontCameraCreate();
    pane = paneElementCreate();
    clipPlaneTool.activate();
  });

  it('places both points with one drag that starts in empty space of a 2D view', () => {
    handler.onPointerDown(frontPointerEvent(handler, -3, 1), camera, pane);
    const end = frontClientPoint(3, -1);
    handler.onEditorPointerMove(end.clientX, end.clientY, false);
    expect(clipPlaneTool.previewPlaneRead()).not.toBeNull();
    handler.onEditorPointerUp(false);
    const points = clipPlaneTool.getPoints();
    expect(points).toHaveLength(2);
    points.forEach((point) => expect(point.z).toBeCloseTo(POINTER_TEST_TARGET_DEPTH));
    expect(points[0]?.x).toBeCloseTo(-3);
    expect(points[1]?.x).toBeCloseTo(3);
    const plane = clipPlaneTool.getPlane();
    expect(plane).not.toBeNull();
    expect(Math.abs(plane?.normal.z ?? 1)).toBeCloseTo(0);
  });

  it('keeps a press without movement as a single click', () => {
    const start = frontClientPoint(-3, 1);
    handler.onPointerDown(frontPointerEvent(handler, -3, 1), camera, pane);
    handler.onEditorPointerMove(start.clientX + CLIP_LINE_DRAG_THRESHOLD_PIXELS / 2, start.clientY, false);
    handler.onEditorPointerUp(false);
    expect(clipPlaneTool.getPoints()).toHaveLength(1);
    expect(clipPlaneTool.isPlaneReady()).toBe(false);
  });

  it('previews the cut under the pointer after point 1 and places point 2 on the next click', () => {
    handler.onPointerDown(frontPointerEvent(handler, -3, 1), camera, pane);
    handler.onEditorPointerUp(false);
    handler.onPointerHover(frontPointerEvent(handler, 3, -1), camera, pane);
    const pointerPoint = clipPlaneTool.hoverPointRead();
    expect(pointerPoint?.x).toBeCloseTo(3);
    expect(clipPlaneTool.isPlaneReady()).toBe(false);
    expect(clipPlaneTool.previewPlaneRead()).not.toBeNull();
    handler.onPointerDown(frontPointerEvent(handler, 3, -1), camera, pane);
    expect(clipPlaneTool.getPoints()).toHaveLength(2);
    expect(clipPlaneTool.hoverPointRead()).toBeNull();
  });

  it('grabs a placed point instead of placing a new one and shows no pointer preview over it', () => {
    handler.onPointerDown(frontPointerEvent(handler, -3, 1), camera, pane);
    handler.onEditorPointerUp(false);
    handler.onPointerHover(frontPointerEvent(handler, -3, 1), camera, pane);
    expect(clipPlaneTool.hoverPointRead()).toBeNull();
    handler.onPointerDown(frontPointerEvent(handler, -3, 1), camera, pane);
    expect(handler.isMarkerDragging()).toBe(true);
    const moved = frontClientPoint(-2, 2);
    handler.onEditorPointerMove(moved.clientX, moved.clientY, false);
    handler.onEditorPointerUp(false);
    expect(clipPlaneTool.getPoints()).toHaveLength(1);
    expect(clipPlaneTool.getPoints()[0]?.x).toBeCloseTo(-2);
  });

  it('cycles the kept side with Tab and with the clip tool key, ignoring key repeat', () => {
    const seen: ClipKeepMode[] = [];
    const press = (event: KeyboardEvent): void => {
      expect(handler.keyDownHandle(event)).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      seen.push(clipPlaneTool.keepModeRead());
    };
    press(keyEvent('Tab', 'Tab'));
    press(keyEvent('KeyX', 'X', { shiftKey: true }));
    press(keyEvent('Tab', 'Tab', { repeat: true }));
    press(keyEvent('Tab', 'Tab'));
    expect(seen).toEqual([ClipKeepMode.SIDE_B, ClipKeepMode.BOTH, ClipKeepMode.BOTH, ClipKeepMode.SIDE_A]);
    expect(handler.keyDownHandle(keyEvent('KeyQ', 'q'))).toBe(false);
  });

  it('applies the cut with Enter using the chosen keep mode', () => {
    handler.onPointerDown(frontPointerEvent(handler, 0, 3), camera, pane);
    const end = frontClientPoint(0, -3);
    handler.onEditorPointerMove(end.clientX, end.clientY, false);
    handler.onEditorPointerUp(false);
    handler.keepModeSet(ClipKeepMode.BOTH);
    expect(handler.keyDownHandle(keyEvent('Enter', 'Enter'))).toBe(true);
    const pieces = selectionManager.getAllSelectedObjectsAsArray();
    expect(pieces).toHaveLength(2);
    expect(target.parent).toBeNull();
    expect(clipPlaneTool.getPoints()).toHaveLength(0);
  });
});
