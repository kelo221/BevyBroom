import { afterEach, describe, expect, it } from 'vitest';
import { DockManager } from '@/ui/dock/manager/dock_manager.js';
import { DockLayoutMemoryStorage } from '@/ui/dock/state/dock_window_layout.js';
import { DOCK_DROP_PREVIEW_ATTRIBUTE } from '@/ui/dock/drop/dock_drop_preview.js';
import { DOCK_DROP_EDGE_BAND_PX } from '@/ui/dock/drop/dock_drop_target.js';
import { PANEL_FLOATING_DOCKED_ATTRIBUTE } from '@/ui/floating_panel/layout/panel_floating_docked_style.js';
import type { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import {
  DockTestFrame,
  dockTestPointerDispatch,
  dockTestRectStub,
  dockTestWindowCreate,
} from '../dock_test_support.js';

/** Dock area every test lays windows out in. */
const DOCK_MANAGER_TEST_AREA = { left: 0, top: 0, width: 1000, height: 600 };

/** Managers and windows created by a test, disposed after it. */
const disposables: { dispose(): void }[] = [];

/**
 * Creates a dock manager over a test frame and storage.
 *
 * @param storage Placement store; a fresh one when omitted.
 * @returns Manager, frame and storage.
 */
function managerCreate(storage = new DockLayoutMemoryStorage()): {
  manager: DockManager;
  frame: DockTestFrame;
  storage: DockLayoutMemoryStorage;
} {
  const frame = new DockTestFrame(DOCK_MANAGER_TEST_AREA);
  const manager = new DockManager(frame, storage);
  disposables.push(manager);
  return { manager, frame, storage };
}

/**
 * Creates a tool window that the test disposes afterwards.
 *
 * @param layoutId Layout id.
 * @param title Title text.
 * @param restoresOpen True to reopen at startup.
 * @returns Window.
 */
function windowCreate(layoutId: string, title: string, restoresOpen = false): PanelFloating {
  const panel = dockTestWindowCreate(layoutId, title, restoresOpen);
  disposables.unshift(panel);
  return panel;
}

/**
 * Finds the title bar of a window by its title text.
 *
 * @param panel Window.
 * @returns Title bar element.
 */
function titleBarFind(panel: PanelFloating): HTMLElement {
  const title = panel.layoutTitleRead();
  const bar = [...panel.getRootElement().children].find((child) => child.firstElementChild?.textContent === title);
  if (!(bar instanceof HTMLElement)) throw new Error(`no title bar for ${title}`);
  return bar;
}

/**
 * Drags a window by its title bar to a client point and releases it there.
 *
 * @param panel Window.
 * @param clientX Release client X.
 * @param clientY Release client Y.
 * @param modifiers Held modifier keys.
 */
function titleDrag(
  panel: PanelFloating,
  clientX: number,
  clientY: number,
  modifiers: { ctrlKey?: boolean } = {},
): void {
  dockTestRectStub(panel.getRootElement(), { left: 300, top: 200, width: 240, height: 200 });
  dockTestPointerDispatch(titleBarFind(panel), 'pointerdown', 320, 210);
  dockTestPointerDispatch(window, 'pointermove', clientX, clientY, modifiers);
  dockTestPointerDispatch(window, 'pointerup', clientX, clientY, modifiers);
}

/**
 * The dock manager docks tool windows to the left, right and bottom edges as
 * tabs, floats them again, docks a window dragged onto an edge, remembers each
 * window's placement and tiles the floating windows.
 */
describe('DockManager', () => {
  afterEach(() => {
    disposables.splice(0).forEach((disposable) => disposable.dispose());
    document.body.replaceChildren();
  });

  it('docks an open window into the pane of an edge and floats it back into its host', () => {
    const { manager, frame } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    manager.windowDock('dock_test_a', 'right');
    expect(frame.panes.right.contains(panel.getRootElement())).toBe(true);
    expect(frame.isDockPaneVisible('right')).toBe(true);
    expect(panel.isOpen()).toBe(true);
    expect(panel.getRootElement().hasAttribute(PANEL_FLOATING_DOCKED_ATTRIBUTE)).toBe(true);
    expect(titleBarFind(panel).style.display).toBe('none');
    manager.windowDock('dock_test_a', null);
    expect(frame.panes.right.contains(panel.getRootElement())).toBe(false);
    expect(panel.getRootElement().parentElement).toBe(document.body);
    expect(panel.getRootElement().style.position).toBe('fixed');
    expect(frame.isDockPaneVisible('right')).toBe(false);
  });

  it('shows windows docked to the same edge as tabs and keeps the dock while one remains', () => {
    const { manager, frame } = managerCreate();
    const first = windowCreate('dock_test_a', 'Window A');
    const second = windowCreate('dock_test_b', 'Window B');
    manager.windowDock('dock_test_a', 'left');
    manager.windowDock('dock_test_b', 'left');
    first.show();
    second.show();
    const tabLabels = [...frame.panes.left.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(tabLabels).toEqual(['Window A', 'Window B']);
    expect(manager.zoneActiveWindowRead('left')).toBe('dock_test_b');
    second.hide();
    expect(frame.isDockPaneVisible('left')).toBe(true);
    expect(manager.zoneActiveWindowRead('left')).toBe('dock_test_a');
    first.hide();
    expect(frame.isDockPaneVisible('left')).toBe(false);
  });

  it('docks a window whose title bar is released near an edge and shows the preview while dragging', () => {
    const { manager, frame } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    dockTestRectStub(panel.getRootElement(), { left: 300, top: 200, width: 240, height: 200 });
    dockTestPointerDispatch(titleBarFind(panel), 'pointerdown', 320, 210);
    const nearBottom = DOCK_MANAGER_TEST_AREA.height - DOCK_DROP_EDGE_BAND_PX / 2;
    dockTestPointerDispatch(window, 'pointermove', 500, nearBottom);
    expect(document.querySelector(`[${DOCK_DROP_PREVIEW_ATTRIBUTE}]`)).not.toBeNull();
    dockTestPointerDispatch(window, 'pointerup', 500, nearBottom);
    expect(document.querySelector(`[${DOCK_DROP_PREVIEW_ATTRIBUTE}]`)).toBeNull();
    expect(frame.panes.bottom.contains(panel.getRootElement())).toBe(true);
    expect(manager.windowStatesRead()['dock_test_a']?.placement).toBe('bottom');
  });

  it('keeps a window floating when released in the middle or while Ctrl is held', () => {
    const { manager } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    titleDrag(panel, 500, 300);
    titleDrag(panel, DOCK_MANAGER_TEST_AREA.width - 4, 300, { ctrlKey: true });
    expect(manager.windowStatesRead()['dock_test_a']?.placement).toBe('floating');
    expect(panel.isDocked()).toBe(false);
  });

  it('floats a docked window from its tab Float button and closes it from Close', () => {
    const { frame } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    titleDrag(panel, 4, 300);
    expect(frame.panes.left.contains(panel.getRootElement())).toBe(true);
    frame.panes.left.querySelector<HTMLButtonElement>('button[title="Float"]')?.click();
    expect(panel.isDocked()).toBe(false);
    expect(panel.isOpen()).toBe(true);
    titleDrag(panel, 4, 300);
    frame.panes.left.querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(panel.isOpen()).toBe(false);
    expect(frame.isDockPaneVisible('left')).toBe(false);
  });

  it('floats a docked window when its tab is dragged off the tab strip', () => {
    const { frame } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    titleDrag(panel, 4, 300);
    const tab = frame.panes.left.querySelector<HTMLElement>('[role="tab"]');
    if (!tab) throw new Error('missing tab');
    dockTestPointerDispatch(tab, 'pointerdown', 10, 5);
    dockTestPointerDispatch(document, 'pointermove', 400, 300);
    expect(panel.isDocked()).toBe(false);
    expect(panel.isOpen()).toBe(true);
    dockTestPointerDispatch(window, 'pointerup', 400, 300);
  });

  it('ignores Escape while docked so only floating windows close on it', () => {
    managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    titleDrag(panel, 4, 300);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.isOpen()).toBe(true);
  });

  it('remembers placement, size and open state for a new manager and reopens windows that ask to', () => {
    const { manager, storage } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A', true);
    panel.show();
    manager.windowDock('dock_test_a', 'right');
    manager.windowFloatingRectSet('dock_test_a', { left: 40, top: 50, width: 300, height: 220 });
    manager.dispose();
    panel.dispose();
    const next = managerCreate(storage);
    const reopened = windowCreate('dock_test_a', 'Window A', true);
    next.manager.windowsOpenRestore();
    expect(reopened.isOpen()).toBe(true);
    expect(next.frame.panes.right.contains(reopened.getRootElement())).toBe(true);
    next.manager.windowDock('dock_test_a', null);
    const style = reopened.getRootElement().style;
    expect([style.left, style.top, style.width, style.height]).toEqual(['40px', '50px', '300px', '220px']);
  });

  it('tiles the open floating windows over the dock area without overlapping', () => {
    const { manager } = managerCreate();
    const panels = ['a', 'b', 'c'].map((suffix) => windowCreate(`dock_test_${suffix}`, `Window ${suffix}`));
    panels.forEach((panel) => panel.show());
    manager.floatingWindowsTile();
    const rects = panels.map((panel) => panel.getRootElement().style);
    const lefts = rects.map((style) => parseFloat(style.left));
    const tops = rects.map((style) => parseFloat(style.top));
    const width = parseFloat(rects[0]?.width ?? '0');
    expect(width).toBeGreaterThan(0);
    expect(new Set(lefts.map((left, index) => `${left},${tops[index]}`)).size).toBe(panels.length);
    lefts.forEach((left) => expect(left + width).toBeLessThanOrEqual(DOCK_MANAGER_TEST_AREA.width));
  });

  it('floats every window again on layout reset', () => {
    const { manager, frame } = managerCreate();
    const panel = windowCreate('dock_test_a', 'Window A');
    panel.show();
    manager.windowDock('dock_test_a', 'bottom');
    manager.layoutReset();
    expect(panel.isOpen()).toBe(true);
    expect(panel.isDocked()).toBe(false);
    expect(frame.isDockPaneVisible('bottom')).toBe(false);
  });
});
