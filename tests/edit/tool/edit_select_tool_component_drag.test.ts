import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditSelectTool } from '@/edit/tool/edit_select_tool.js';
import { TranslateTool } from '@/editor/tools/translate_tool.js';
import { POINTER_DRAG_THRESHOLD_PIXELS } from '@/input/pointer_drag_threshold.js';
import { EditorStalePressRelease } from '@/editor/window/editor_stale_press_release.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { editorTestServicesCreate } from '../../editor/editor_test_services.js';

/** Spies a component drag test inspects. */
interface ComponentDragSpies {
  beginSingleUseDrag: ReturnType<typeof vi.fn<EditorServices['beginSingleUseDrag']>>;
  applySingleUsePointerMove: ReturnType<typeof vi.fn<EditorServices['applySingleUsePointerMove']>>;
  commitActiveTransformDrag: ReturnType<typeof vi.fn<EditorServices['commitActiveTransformDrag']>>;
}

/**
 * Builds transform drag spies that track whether a drag is running.
 *
 * @returns Spies and a reader of the running state.
 */
function componentDragSpiesCreate(): { spies: ComponentDragSpies; isDragActive: () => boolean } {
  let isDragActive = false;
  const spies: ComponentDragSpies = {
    beginSingleUseDrag: vi.fn<EditorServices['beginSingleUseDrag']>(() => {
      isDragActive = true;
      return true;
    }),
    applySingleUsePointerMove: vi.fn<EditorServices['applySingleUsePointerMove']>(),
    commitActiveTransformDrag: vi.fn<EditorServices['commitActiveTransformDrag']>(() => {
      isDragActive = false;
    }),
  };
  return { spies, isDragActive: () => isDragActive };
}

/**
 * Builds an editor in Edit Select whose component pick result and transform
 * drag services are controlled by the test.
 *
 * @param pickHitsComponent Whether a press picks a component.
 * @returns Editor window and the transform drag spies.
 */
function editorInEditSelectCreate(pickHitsComponent: boolean): { editor: EditorWindow; spies: ComponentDragSpies } {
  const { spies, isDragActive } = componentDragSpiesCreate();
  const editor = new EditorWindow();
  editor.setServices(
    editorTestServicesCreate({
      ...spies,
      isEditModeActive: () => true,
      getSelectedCount: () => (pickHitsComponent ? 1 : 0),
      getTransformTargets: () => [new THREE.Object3D()],
      getActiveCamera: () => new THREE.PerspectiveCamera(),
      getActivePickElement: () => document.createElement('div'),
      isTransformDragActive: isDragActive,
      beginEditSelectPointerDown: () => pickHitsComponent,
    }),
  );
  editor.userSwitchToEditSelectTool();
  return { editor, spies };
}

/**
 * Moves the editor pointer and raises a left-button global drag.
 *
 * @param editor Editor window.
 * @param clientX New pointer client X.
 * @param clientY New pointer client Y.
 */
function leftDragTo(editor: EditorWindow, clientX: number, clientY: number): void {
  pointerClientWrite(editor, clientX, clientY);
  editor.onGlobalMouseDrag(0, new THREE.Vector2(), new THREE.Vector2());
}

/**
 * Presses the left button at a client point.
 *
 * @param editor Editor window.
 * @param press Press client point.
 */
function leftPressAt(editor: EditorWindow, press: THREE.Vector2): void {
  pointerClientWrite(editor, press.x, press.y);
  editor.activeTool?.onMouseDown(0);
}

/**
 * Stores a known editor pointer client position.
 *
 * @param editor Editor window.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 */
function pointerClientWrite(editor: EditorWindow, clientX: number, clientY: number): void {
  editor.lastPointerClientX = clientX;
  editor.lastPointerClientY = clientY;
  editor.hasLastPointerClient = true;
}

describe('EditSelectTool component drag', () => {
  it('moves the picked components from the press point and commits on release', () => {
    const { editor, spies } = editorInEditSelectCreate(true);
    const press = new THREE.Vector2(200, 150);
    leftPressAt(editor, press);
    const target = press.clone().add(new THREE.Vector2(POINTER_DRAG_THRESHOLD_PIXELS * 3, 0));
    leftDragTo(editor, target.x, target.y);
    expect(editor.activeTool).toBeInstanceOf(TranslateTool);
    expect(spies.beginSingleUseDrag.mock.calls[0]?.slice(5)).toEqual([press.x, press.y]);
    expect(spies.applySingleUsePointerMove.mock.calls.at(-1)?.slice(0, 2)).toEqual([target.x, target.y]);
    editor.onGlobalMouseUp(0);
    expect(spies.commitActiveTransformDrag).toHaveBeenCalledTimes(1);
    expect(editor.activeTool).toBeInstanceOf(EditSelectTool);
  });

  it('keeps a press that stays within the drag threshold a plain pick', () => {
    const { editor, spies } = editorInEditSelectCreate(true);
    leftPressAt(editor, new THREE.Vector2(120, 90));
    leftDragTo(editor, 120 + POINTER_DRAG_THRESHOLD_PIXELS / 2, 90);
    editor.onGlobalMouseUp(0);
    expect(editor.activeTool).toBeInstanceOf(EditSelectTool);
    expect(spies.beginSingleUseDrag).not.toHaveBeenCalled();
  });

  it('does not start a move when the press picked no component', () => {
    const { editor, spies } = editorInEditSelectCreate(false);
    leftPressAt(editor, new THREE.Vector2(50, 60));
    leftDragTo(editor, 50 + POINTER_DRAG_THRESHOLD_PIXELS * 10, 60);
    expect(editor.activeTool).toBeInstanceOf(EditSelectTool);
    expect(spies.beginSingleUseDrag).not.toHaveBeenCalled();
  });

  it('forgets the pending press when the tool loses focus', () => {
    const { editor, spies } = editorInEditSelectCreate(true);
    leftPressAt(editor, new THREE.Vector2(70, 70));
    editor.activeTool?.onFocusLost();
    leftDragTo(editor, 70 + POINTER_DRAG_THRESHOLD_PIXELS * 10, 70);
    expect(spies.beginSingleUseDrag).not.toHaveBeenCalled();
  });

  it('commits a dragged move whose release was lost instead of staying busy', () => {
    const { editor, spies } = editorInEditSelectCreate(true);
    leftPressAt(editor, new THREE.Vector2(80, 80));
    leftDragTo(editor, 80 + POINTER_DRAG_THRESHOLD_PIXELS * 5, 80);
    expect(editor.isActiveEventReceiverBusy).toBe(true);
    expect(EditorStalePressRelease.release(editor)).toBe(true);
    expect(spies.commitActiveTransformDrag).toHaveBeenCalledTimes(1);
    expect(editor.activeTool).toBeInstanceOf(EditSelectTool);
  });

  it('keeps a keyboard grab busy when a stale press release is attempted', () => {
    const { editor } = editorInEditSelectCreate(true);
    editor.useSingleUseTranslateTool();
    expect(EditorStalePressRelease.release(editor)).toBe(false);
    expect(editor.isActiveEventReceiverBusy).toBe(true);
  });
});
