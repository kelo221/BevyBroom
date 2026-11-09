import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { EditorStalePressRelease } from '@/editor/window/editor_stale_press_release.js';
import { Tool } from '@/editor/tools/tool.js';
import { POINTER_DRAG_THRESHOLD_PIXELS } from '@/input/pointer_drag_threshold.js';
import type { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';
import { editorTestServicesCreate } from '../editor_test_services.js';

/** Side length in CSS pixels of the square test viewport. */
const STALE_PRESS_VIEWPORT_SIZE = 240;

/** Spies of the fake object drag session. */
interface FakeObjectDragSession {
  session: ObjectDragSession;
  cancel: ReturnType<typeof vi.fn>;
}

/** Tool that stays busy on its own, independent of any pointer press. */
class ToolBusyWithoutPress extends Tool {
  /**
   * Always busy.
   *
   * @returns True.
   */
  override isBusy(): boolean {
    return true;
  }
}

/**
 * Builds a fake object drag session.
 *
 * @returns Session and its cancel spy.
 */
function fakeObjectDragSessionCreate(): FakeObjectDragSession {
  const cancel = vi.fn();
  const session = { update: vi.fn(), commit: vi.fn(), cancel } as unknown as ObjectDragSession;
  return { session, cancel };
}

/**
 * Dispatches a left-button pointer event.
 *
 * @param target Element that receives the event.
 * @param type Pointer event type.
 * @param clientX Client X.
 * @param buttons Held buttons bitfield.
 */
function leftPointerDispatch(target: HTMLElement, type: string, clientX: number, buttons: number): void {
  const clientY = STALE_PRESS_VIEWPORT_SIZE / 2;
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0, buttons }),
  );
}

describe('EditorStalePressRelease', () => {
  let host: HTMLElement;
  let viewportContent: HTMLElement;
  let editor: EditorWindow;
  let bridge: EditorInputBridge;
  let fakeSession: FakeObjectDragSession;

  beforeEach(() => {
    host = document.createElement('div');
    viewportContent = document.createElement('div');
    document.body.append(host, viewportContent);
    const size = STALE_PRESS_VIEWPORT_SIZE;
    viewportContent.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: size, bottom: size, width: size, height: size, x: 0, y: 0 }) as DOMRect;
    fakeSession = fakeObjectDragSessionCreate();
    editor = new EditorWindow();
    editor.setServices(editorTestServicesCreate({ beginObjectDragAtClientPoint: () => fakeSession.session }));
    editor.validateTools();
    bridge = new EditorInputBridge(editor);
    bridge.install(host);
    bridge.setExclusiveViewportRoots([viewportContent]);
  });

  afterEach(() => {
    bridge.uninstall();
    host.remove();
    viewportContent.remove();
  });

  /** Starts an object drag in the viewport whose release never arrives. */
  function objectDragWithLostReleaseStart(): void {
    const pressX = STALE_PRESS_VIEWPORT_SIZE / 4;
    leftPointerDispatch(viewportContent, 'pointerdown', pressX, 1);
    leftPointerDispatch(viewportContent, 'pointermove', pressX + POINTER_DRAG_THRESHOLD_PIXELS * 4, 1);
  }

  it('frees the tool rail when a press lands on chrome while a drag whose release was lost holds the shield', () => {
    objectDragWithLostReleaseStart();
    expect(editor.isActiveEventReceiverBusy).toBe(true);
    const shield = bridge.getMountedExclusiveShieldElement(document);
    expect(shield).not.toBeNull();
    leftPointerDispatch(shield ?? host, 'pointerdown', STALE_PRESS_VIEWPORT_SIZE + 100, 1);
    expect(editor.isActiveEventReceiverBusy).toBe(false);
    expect(bridge.isExclusiveShieldMounted()).toBe(false);
    expect(fakeSession.cancel).toHaveBeenCalledTimes(1);
    expect(editor.isLeftMousePressed).toBe(false);
  });

  it('keeps a live drag when another button is pressed over chrome while the left button is held', () => {
    objectDragWithLostReleaseStart();
    const shield = bridge.getMountedExclusiveShieldElement(document);
    const outsideX = STALE_PRESS_VIEWPORT_SIZE + 100;
    const clientY = STALE_PRESS_VIEWPORT_SIZE / 2;
    const rightPress = { bubbles: true, cancelable: true, clientX: outsideX, clientY, button: 2, buttons: 3 };
    (shield ?? host).dispatchEvent(new PointerEvent('pointerdown', rightPress));
    expect(fakeSession.cancel).not.toHaveBeenCalled();
    expect(editor.isActiveEventReceiverBusy).toBe(true);
  });

  it('keeps a drag whose button is still held when tool switching asks', () => {
    objectDragWithLostReleaseStart();
    expect(EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editor, bridge.heldButtonsRead())).toBe(true);
    expect(fakeSession.cancel).not.toHaveBeenCalled();
  });

  it('drops a drag whose release was lost once a pointer sample shows no button held', () => {
    objectDragWithLostReleaseStart();
    const hoverX = STALE_PRESS_VIEWPORT_SIZE / 2;
    leftPointerDispatch(bridge.getMountedExclusiveShieldElement(document) ?? host, 'pointermove', hoverX, 0);
    expect(EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editor, bridge.heldButtonsRead())).toBe(false);
    expect(fakeSession.cancel).toHaveBeenCalledTimes(1);
  });

  it('never frees a tool whose busy state does not come from a press', () => {
    editor.switchTool(new ToolBusyWithoutPress());
    expect(EditorStalePressRelease.release(editor)).toBe(false);
    expect(EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editor, bridge.heldButtonsRead())).toBe(true);
  });
});
