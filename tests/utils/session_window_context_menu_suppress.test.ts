import { afterEach, describe, expect, it } from 'vitest';
import { WindowContextMenuSuppressSession } from '@/utils/session_window_context_menu_suppress.js';

/**
 * Dispatches a cancelable context menu event on the window.
 *
 * @returns True when a listener prevented the browser menu.
 */
function contextMenuDispatchIsPrevented(): boolean {
  const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
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

describe('WindowContextMenuSuppressSession', () => {
  const session = new WindowContextMenuSuppressSession();

  afterEach(() => {
    session.remove();
  });

  it('blocks the context menu from install until remove', () => {
    expect(contextMenuDispatchIsPrevented()).toBe(false);
    session.install(window);
    expect(session.isInstalled()).toBe(true);
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    session.remove();
    expect(session.isInstalled()).toBe(false);
    expect(contextMenuDispatchIsPrevented()).toBe(false);
  });

  it('keeps blocking through the release task and stops on the next task', async () => {
    session.install(window);
    session.removeAfterRelease();
    expect(contextMenuDispatchIsPrevented()).toBe(true);
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(false);
  });

  it('ignores a pending removal once a newer install happened', async () => {
    session.install(window);
    session.removeAfterRelease();
    session.install(window);
    await nextTaskWait();
    expect(contextMenuDispatchIsPrevented()).toBe(true);
  });
});
