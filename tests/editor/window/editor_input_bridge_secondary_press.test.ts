import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { editorTestServicesCreate } from '../editor_test_services.js';

/** Side length in CSS pixels of the square test viewport. */
const VIEWPORT_SIZE = 240;

/** Mouse button index of the right button. */
const RIGHT_BUTTON = 2;

/**
 * Makes an element report a square client rectangle at the page origin.
 *
 * @param element Element whose bounds are replaced.
 * @param size Square side length in CSS pixels.
 */
function contentBoundsMock(element: HTMLElement, size: number): void {
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: size, bottom: size, width: size, height: size, x: 0, y: 0 }) as DOMRect;
}

/**
 * Dispatches a pointer event at the viewport centre.
 *
 * @param target Element that receives the event.
 * @param type Pointer event type.
 * @param button Changed button index.
 * @param buttons Held buttons bitfield.
 */
function pointerAtViewportCentreDispatch(target: HTMLElement, type: string, button: number, buttons: number): void {
  const centre = VIEWPORT_SIZE / 2;
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: centre, clientY: centre, button, buttons }),
  );
}

/**
 * Dispatches a cancelable context menu event on the window.
 *
 * @returns True when a listener prevented the browser menu.
 */
function contextMenuDispatchIsPrevented(): boolean {
  const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: RIGHT_BUTTON });
  window.dispatchEvent(contextMenu);
  return contextMenu.defaultPrevented;
}

/**
 * Waits until the tasks queued with a zero timeout have run.
 *
 * @returns Promise resolved on the next task.
 */
function nextTaskWait(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('EditorInputBridge right-button press guard', () => {
  let host: HTMLElement;
  let viewportContent: HTMLElement;
  let editor: EditorWindow;
  let bridge: EditorInputBridge;

  beforeEach(() => {
    host = document.createElement('div');
    viewportContent = document.createElement('div');
    document.body.append(host, viewportContent);
    contentBoundsMock(viewportContent, VIEWPORT_SIZE);
    editor = new EditorWindow();
    editor.setServices(editorTestServicesCreate());
    editor.validateTools();
    bridge = new EditorInputBridge(editor);
    bridge.install(host);
    bridge.setExclusiveViewportRoots([viewportContent]);
  });

  afterEach(async () => {
    bridge.uninstall();
    host.remove();
    viewportContent.remove();
    await nextTaskWait();
  });

  it('blocks the context menu that follows the release of a viewport right press, then lets it lapse', async () => {
    expect(contextMenuDispatchIsPrevented()).toBe(false);
    pointerAtViewportCentreDispatch(viewportContent, 'pointerdown', RIGHT_BUTTON, RIGHT_BUTTON);
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    pointerAtViewportCentreDispatch(viewportContent, 'pointerup', RIGHT_BUTTON, 0);
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(false);
  });

  it('routes the right release to the editor when the press began over a viewport', () => {
    const globalMouseUp = vi.spyOn(editor, 'onGlobalMouseUp');
    pointerAtViewportCentreDispatch(viewportContent, 'pointerdown', RIGHT_BUTTON, RIGHT_BUTTON);
    pointerAtViewportCentreDispatch(viewportContent, 'pointerup', RIGHT_BUTTON, 0);
    expect(globalMouseUp.mock.calls).toEqual([[RIGHT_BUTTON]]);
  });
});
