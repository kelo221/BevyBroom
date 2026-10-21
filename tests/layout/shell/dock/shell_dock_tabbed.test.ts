import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellDockTabbed, type ShellDockTabDefinition } from '@/layout/shell/dock/shell_dock_tabbed.js';

/** Tabs used by every dock in these tests. */
const SHELL_DOCK_TEST_TABS: readonly ShellDockTabDefinition[] = [
  { id: 'alpha', label: 'Alpha', tooltip: 'Alpha tooltip' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
];

/**
 * Builds a mounted tabbed dock over the test tabs.
 *
 * @param initialTabId Tab shown first.
 * @returns Tabbed dock attached to the document.
 */
function shellDockTestCreate(initialTabId: string): ShellDockTabbed {
  const dock = new ShellDockTabbed('Test dock', SHELL_DOCK_TEST_TABS, initialTabId);
  document.body.appendChild(dock.getElement());
  return dock;
}

/**
 * Returns the tab strip button of one tab.
 *
 * @param dock Dock holding the tab.
 * @param tabId Tab id.
 * @returns Tab button.
 */
function shellDockTestTabButtonRead(dock: ShellDockTabbed, tabId: string): HTMLButtonElement {
  const button = dock.getElement().querySelector<HTMLButtonElement>(`[role="tab"][data-tab-id="${tabId}"]`);
  if (!button) {
    throw new Error(`Tab button ${tabId} not found`);
  }
  return button;
}

/**
 * Returns whether a page is attached to the document and not inside a hidden
 * wrapper.
 *
 * @param page Page element.
 * @returns True while the page is visible.
 */
function shellDockTestIsPageVisible(page: HTMLElement | null): boolean {
  return page !== null && page.isConnected && page.closest('[hidden]') === null;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShellDockTabbed', () => {
  it('shows the requested initial tab and only its page', () => {
    const dock = shellDockTestCreate('beta');
    expect(dock.activeTabIdRead()).toBe('beta');
    expect(shellDockTestIsPageVisible(dock.pageRead('beta'))).toBe(true);
    expect(shellDockTestIsPageVisible(dock.pageRead('alpha'))).toBe(false);
    expect(shellDockTestTabButtonRead(dock, 'beta').getAttribute('aria-selected')).toBe('true');
    expect(shellDockTestTabButtonRead(dock, 'alpha').getAttribute('aria-selected')).toBe('false');
  });

  it('falls back to the first tab when the initial tab id is unknown', () => {
    const dock = shellDockTestCreate('missing');
    expect(dock.activeTabIdRead()).toBe(SHELL_DOCK_TEST_TABS[0]?.id);
  });

  it('labels the tab buttons and keeps tooltips only where defined', () => {
    const dock = shellDockTestCreate('alpha');
    SHELL_DOCK_TEST_TABS.forEach((tab) => {
      const button = shellDockTestTabButtonRead(dock, tab.id);
      expect(button.textContent).toBe(tab.label);
      expect(button.title).toBe(tab.tooltip ?? '');
    });
  });

  it('returns one distinct page per tab and null for an unknown tab', () => {
    const dock = shellDockTestCreate('alpha');
    const pages = SHELL_DOCK_TEST_TABS.map((tab) => dock.pageRead(tab.id));
    pages.forEach((page) => expect(page).toBeInstanceOf(HTMLElement));
    expect(new Set(pages).size).toBe(SHELL_DOCK_TEST_TABS.length);
    expect(dock.pageRead('missing')).toBeNull();
  });

  it('switches tabs with tabShow, keeps earlier pages mounted and rejects unknown ids', () => {
    const dock = shellDockTestCreate('alpha');
    const alphaPage = dock.pageRead('alpha');
    expect(dock.tabShow('gamma')).toBe(true);
    expect(dock.activeTabIdRead()).toBe('gamma');
    expect(shellDockTestIsPageVisible(dock.pageRead('gamma'))).toBe(true);
    expect(alphaPage?.isConnected).toBe(true);
    expect(shellDockTestIsPageVisible(alphaPage)).toBe(false);
    expect(dock.tabShow('missing')).toBe(false);
    expect(dock.activeTabIdRead()).toBe('gamma');
  });

  it('switches tabs when a tab button is clicked', () => {
    const dock = shellDockTestCreate('alpha');
    shellDockTestTabButtonRead(dock, 'beta').click();
    expect(dock.activeTabIdRead()).toBe('beta');
    expect(shellDockTestIsPageVisible(dock.pageRead('beta'))).toBe(true);
  });

  it('tells change listeners each newly shown tab until they are removed', () => {
    const dock = shellDockTestCreate('alpha');
    const listener = vi.fn();
    const listenerRemove = dock.tabChangeListenerAdd(listener);
    dock.tabShow('beta');
    dock.tabShow('beta');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('beta');
    listenerRemove();
    dock.tabShow('gamma');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('removes its element from the document and forgets its pages on dispose', () => {
    const dock = shellDockTestCreate('alpha');
    const listener = vi.fn();
    dock.tabChangeListenerAdd(listener);
    dock.dispose();
    expect(dock.getElement().isConnected).toBe(false);
    expect(dock.pageRead('alpha')).toBeNull();
    expect(dock.tabShow('beta')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
