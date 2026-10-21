import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { POINTER_DRAG_THRESHOLD_PIXELS } from '@/input/pointer_drag_threshold.js';
import { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';
import type { ObjectDragPointerSample } from '@/tools/object_drag/object_drag_pointer_sample.js';
import { editorTestServicesCreate } from '../../editor_test_services.js';
import { OBJECT_DRAG_TEST_VIEWPORT_RECT } from '../../../tools/object_drag/object_drag_test_viewport.js';

/** Object drag session that records what the tool asks of it. */
class ObjectDragSessionRecording extends ObjectDragSession {
  readonly updates: ObjectDragPointerSample[] = [];
  commitCount = 0;
  cancelCount = 0;

  /**
   * Records a pointer sample.
   *
   * @param sample Pointer sample.
   */
  protected sessionUpdate(sample: ObjectDragPointerSample): void {
    this.updates.push({ ...sample });
  }

  /** Counts the commit. */
  protected sessionCommit(): void {
    this.commitCount++;
  }

  /** Counts the cancel. */
  protected sessionCancel(): void {
    this.cancelCount++;
  }
}

/** Modifier keys held during a pointer event. */
interface PointerTestKeys {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Dispatches a left-button pointer event on an element.
 *
 * @param target Element receiving the event.
 * @param type Pointer event type.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @param keys Held modifier keys.
 */
function pointerDispatch(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
  keys: PointerTestKeys = {},
): void {
  const buttonHeld = type !== 'pointerup';
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: type === 'pointermove' ? -1 : 0,
      buttons: buttonHeld ? 1 : 0,
      shiftKey: keys.shiftKey === true,
      ctrlKey: keys.ctrlKey === true,
      altKey: keys.altKey === true,
    }),
  );
}

/**
 * Proves the object tools tell clicks from drags: a press released in place
 * selects, a press moved past the threshold starts the object drag the press
 * implies (and never clicks), Escape cancels, modifier keys re-apply, and the
 * permanent transform tools behave the same.
 */
describe('BoxSelectTool object drags through editor pointer events', () => {
  let viewportRoot: HTMLElement;
  let editor: EditorWindow;
  let bridge: EditorInputBridge;
  const pressX = OBJECT_DRAG_TEST_VIEWPORT_RECT.left + OBJECT_DRAG_TEST_VIEWPORT_RECT.width / 2;
  const pressY = OBJECT_DRAG_TEST_VIEWPORT_RECT.top + OBJECT_DRAG_TEST_VIEWPORT_RECT.height / 2;
  const dragDistance = POINTER_DRAG_THRESHOLD_PIXELS * 10;

  /**
   * Installs the editor with services and pins the test viewport root.
   *
   * @param overrides Service members the test needs.
   */
  function editorInstall(overrides: Partial<EditorServices>): void {
    editor.setServices(editorTestServicesCreate(overrides));
    editor.validateTools();
    editor.userSwitchToBoundsTool();
    bridge.install(document.body);
    bridge.setExclusiveViewportRoots([viewportRoot]);
  }

  beforeEach(() => {
    viewportRoot = document.createElement('div');
    viewportRoot.getBoundingClientRect = () => OBJECT_DRAG_TEST_VIEWPORT_RECT;
    document.body.appendChild(viewportRoot);
    editor = new EditorWindow();
    bridge = new EditorInputBridge(editor);
  });

  afterEach(() => {
    bridge.uninstall();
    viewportRoot.remove();
  });

  it('applies click selection when the pointer stays within the drag threshold', () => {
    const applyClick = vi.fn();
    const beginDrag = vi.fn(() => null);
    editorInstall({ applyObjectClickSelectionAtClientPoint: applyClick, beginObjectDragAtClientPoint: beginDrag });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
    pointerDispatch(viewportRoot, 'pointermove', pressX + POINTER_DRAG_THRESHOLD_PIXELS, pressY);
    pointerDispatch(viewportRoot, 'pointerup', pressX + POINTER_DRAG_THRESHOLD_PIXELS, pressY);
    expect(beginDrag).not.toHaveBeenCalled();
    expect(applyClick).toHaveBeenCalledTimes(1);
  });

  it('starts the drag at the press point, feeds it and commits on release without clicking', () => {
    const applyClick = vi.fn();
    const session = new ObjectDragSessionRecording();
    const beginDrag = vi.fn((_press: ObjectDragPointerSample) => session);
    editorInstall({ applyObjectClickSelectionAtClientPoint: applyClick, beginObjectDragAtClientPoint: beginDrag });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY, { ctrlKey: true });
    pointerDispatch(viewportRoot, 'pointermove', pressX + dragDistance, pressY, { ctrlKey: true });
    expect(beginDrag).toHaveBeenCalledTimes(1);
    expect(beginDrag.mock.calls[0]?.[0]).toMatchObject({ clientX: pressX, clientY: pressY, ctrlKey: true });
    expect(editor.activeTool?.isBusy()).toBe(true);
    pointerDispatch(viewportRoot, 'pointermove', pressX + dragDistance * 2, pressY);
    expect(session.updates.at(-1)?.clientX).toBe(pressX + dragDistance * 2);
    pointerDispatch(viewportRoot, 'pointerup', pressX + dragDistance * 2, pressY);
    expect(session.commitCount).toBe(1);
    expect(applyClick).not.toHaveBeenCalled();
    expect(editor.activeTool?.isBusy()).toBe(false);
  });

  it('does nothing on release when the drag started no session', () => {
    const applyClick = vi.fn();
    editorInstall({ applyObjectClickSelectionAtClientPoint: applyClick, beginObjectDragAtClientPoint: () => null });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
    pointerDispatch(viewportRoot, 'pointermove', pressX, pressY + dragDistance);
    pointerDispatch(viewportRoot, 'pointerup', pressX, pressY + dragDistance);
    expect(applyClick).not.toHaveBeenCalled();
  });

  it('cancels the drag on Escape and does not click on the following release', () => {
    const applyClick = vi.fn();
    const session = new ObjectDragSessionRecording();
    editorInstall({ applyObjectClickSelectionAtClientPoint: applyClick, beginObjectDragAtClientPoint: () => session });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
    pointerDispatch(viewportRoot, 'pointermove', pressX + dragDistance, pressY);
    expect(editor.onKeyDown('Escape', new KeyboardEvent('keydown', { code: 'Escape' }))).toBe(true);
    expect(session.cancelCount).toBe(1);
    expect(editor.activeTool?.isBusy()).toBe(false);
    pointerDispatch(viewportRoot, 'pointerup', pressX + dragDistance, pressY);
    expect(session.commitCount).toBe(0);
    expect(applyClick).not.toHaveBeenCalled();
  });

  it('re-applies the drag when Alt is pressed and released without moving the pointer', () => {
    const session = new ObjectDragSessionRecording();
    editorInstall({ beginObjectDragAtClientPoint: () => session });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
    pointerDispatch(viewportRoot, 'pointermove', pressX + dragDistance, pressY);
    editor.onKeyDown('AltLeft', new KeyboardEvent('keydown', { code: 'AltLeft', altKey: true }));
    expect(session.updates.at(-1)?.altKey).toBe(true);
    editor.onKeyUp('AltLeft');
    expect(session.updates.at(-1)?.altKey).toBe(false);
    expect(session.updates.at(-1)?.clientX).toBe(pressX + dragDistance);
    pointerDispatch(viewportRoot, 'pointerup', pressX + dragDistance, pressY);
  });

  it('starts object drags from the permanent translate, rotate and scale tools', () => {
    const beginDrag = vi.fn(() => new ObjectDragSessionRecording());
    editorInstall({ beginObjectDragAtClientPoint: beginDrag });
    const switches = [
      () => editor.userSwitchToTranslateTool(),
      () => editor.userSwitchToRotateTool(),
      () => editor.userSwitchToScaleTool(),
    ];
    for (const switchTool of switches) {
      switchTool();
      pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
      pointerDispatch(viewportRoot, 'pointermove', pressX + dragDistance, pressY);
      pointerDispatch(viewportRoot, 'pointerup', pressX + dragDistance, pressY);
    }
    expect(beginDrag).toHaveBeenCalledTimes(switches.length);
  });

  it('keeps clicks working while the clicked tool has no drag service', () => {
    const applyClick = vi.fn();
    editorInstall({ applyObjectClickSelectionAtClientPoint: applyClick });
    pointerDispatch(viewportRoot, 'pointerdown', pressX, pressY);
    pointerDispatch(viewportRoot, 'pointerup', pressX, pressY);
    expect(applyClick).toHaveBeenCalledWith(pressX, pressY, false, false);
    expect(new THREE.Vector2(editor.lastPointerClientX, editor.lastPointerClientY).toArray()).toEqual([pressX, pressY]);
  });
});
