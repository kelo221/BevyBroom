import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import { panelLeftTopRead, stubPanelRectFromStyle, titleBarDrag } from './panel_floating_test_support.js';

/** Floating windows built by the running test. */
const contentHostTestWindows: PanelFloatingContentHost[] = [];

/** Floating window, its host and its content a test works with. */
interface ContentHostTestRig {
  readonly floatingWindow: PanelFloatingContentHost;
  readonly host: HTMLElement;
  readonly content: HTMLElement;
}

/**
 * Builds a floating window over a fresh host holding one content element.
 *
 * @returns Test rig.
 */
function contentHostTestCreate(): ContentHostTestRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const content = document.createElement('div');
  content.textContent = 'Hosted content';
  const floatingWindow = new PanelFloatingContentHost(
    host,
    {
      titleText: 'Test Window',
      className: 'panel-floating-test-window',
      width: '200px',
      height: '100px',
      corner: 'top-left',
    },
    content,
  );
  contentHostTestWindows.push(floatingWindow);
  return { floatingWindow, host, content };
}

afterEach(() => {
  contentHostTestWindows.splice(0).forEach((floatingWindow) => floatingWindow.dispose());
  document.body.replaceChildren();
});

describe('PanelFloatingContentHost', () => {
  it('holds the content in its body and starts closed', () => {
    const { floatingWindow, host, content } = contentHostTestCreate();
    expect(floatingWindow.bodyRead().contains(content)).toBe(true);
    expect(floatingWindow.isOpen()).toBe(false);
    expect(host.contains(content)).toBe(false);
  });

  it('mounts under the host with its title and class when shown', () => {
    const { floatingWindow, host, content } = contentHostTestCreate();
    floatingWindow.show();
    expect(floatingWindow.isOpen()).toBe(true);
    expect(host.contains(content)).toBe(true);
    const root = host.querySelector('.panel-floating-test-window');
    expect(root).not.toBeNull();
    expect(root?.textContent ?? '').toContain('Test Window');
  });

  it('tells open change listeners about every open and close until removed', () => {
    const { floatingWindow } = contentHostTestCreate();
    const listener = vi.fn();
    const listenerRemove = floatingWindow.openChangeListenerAdd(listener);
    floatingWindow.show();
    floatingWindow.hide();
    expect(listener.mock.calls).toEqual([[true], [false]]);
    listenerRemove();
    floatingWindow.toggle();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a moved position on reopen when centered', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const panelWidth = 100;
    const panelHeight = 60;
    const centeredWindow = new PanelFloatingContentHost(
      host,
      {
        titleText: 'Centered',
        className: 'panel-floating-centered',
        width: `${panelWidth}px`,
        height: `${panelHeight}px`,
        corner: 'top-left',
        centered: true,
      },
      document.createElement('div'),
    );
    contentHostTestWindows.push(centeredWindow);
    stubPanelRectFromStyle(centeredWindow.getRootElement(), panelWidth, panelHeight);
    centeredWindow.show();
    const start = panelLeftTopRead(centeredWindow);
    const titleBar = centeredWindow.getRootElement().firstElementChild;
    if (!(titleBar instanceof HTMLElement)) {
      throw new Error('centered window title bar');
    }
    titleBarDrag(titleBar, start.left + 10, start.top + 5, 33, 0);
    const moved = panelLeftTopRead(centeredWindow);
    centeredWindow.hide();
    centeredWindow.show();
    expect(panelLeftTopRead(centeredWindow)).toEqual(moved);
  });

  it('stays open on Escape by default and closes on Escape when asked to', () => {
    const { floatingWindow } = contentHostTestCreate();
    const escapeClosing = new PanelFloatingContentHost(
      document.body,
      {
        titleText: 'Escape',
        className: 'panel-floating-escape',
        width: '100px',
        height: 'auto',
        corner: 'top-left',
        closeOnEscape: true,
      },
      document.createElement('div'),
    );
    contentHostTestWindows.push(escapeClosing);
    floatingWindow.show();
    escapeClosing.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(floatingWindow.isOpen()).toBe(true);
    expect(escapeClosing.isOpen()).toBe(false);
  });
});
