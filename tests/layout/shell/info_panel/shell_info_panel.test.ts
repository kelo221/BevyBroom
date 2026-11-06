import { afterEach, describe, expect, it } from 'vitest';
import {
  SHELL_INFO_PANEL_TABS,
  ShellInfoPanel,
  type ShellInfoPanelStripClick,
  type ShellInfoPanelTabId,
} from '@/layout/shell/info_panel/shell_info_panel.js';
import { SHELL_INFO_PANEL_COLLAPSED_CLASS } from '@/layout/shell/info_panel/shell_info_panel_styles.js';
import { infoPanelStripRevealTabWrite } from '@/info_panel/strip/info_panel_strip_reveal.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellStateDefaultCreate } from '@/layout/shell/state/shell_state.js';
import { shellTestInfoPanelTabButtonRead, shellTestStorageCreate } from '../shell_test_support.js';

/** Every info panel tab id. */
const SHELL_INFO_PANEL_TEST_TAB_IDS: readonly ShellInfoPanelTabId[] = ['console', 'issues'];

/**
 * Builds a mounted info panel over a store kept in the given storage.
 *
 * @param storage Storage the shell state is kept in.
 * @returns Info panel and its store.
 */
function shellInfoPanelTestCreate(storage: Storage): { infoPanel: ShellInfoPanel; stateStore: ShellStateStore } {
  const stateStore = new ShellStateStore(storage);
  const infoPanel = new ShellInfoPanel(stateStore);
  document.body.appendChild(infoPanel.getElement());
  return { infoPanel, stateStore };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShellInfoPanel', () => {
  it('offers the Console and Issues tabs and starts on the default tab', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    const tabIds = [...infoPanel.getElement().querySelectorAll<HTMLElement>('[role="tab"]')].map(
      (button) => button.dataset['tabId'],
    );
    expect(tabIds).toEqual(SHELL_INFO_PANEL_TABS.map((tab) => tab.id));
    expect(SHELL_INFO_PANEL_TABS.map((tab) => tab.label)).toEqual(['Console', 'Issues']);
    expect(infoPanel.activeTabIdRead()).toBe(shellStateDefaultCreate().infoPanelTabId);
    expect(infoPanel.getElement().classList.contains('shell-info-panel')).toBe(true);
  });

  it('returns the distinct page of every tab as its slot', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    const slots = SHELL_INFO_PANEL_TEST_TAB_IDS.map((tabId) => infoPanel.slotRead(tabId));
    expect(new Set(slots).size).toBe(SHELL_INFO_PANEL_TEST_TAB_IDS.length);
    SHELL_INFO_PANEL_TEST_TAB_IDS.forEach((tabId) => {
      expect(infoPanel.slotRead(tabId)).toBe(infoPanel.pageRead(tabId));
    });
  });

  it('remembers the shown tab and restores it in a fresh info panel', () => {
    const storage = shellTestStorageCreate();
    const first = shellInfoPanelTestCreate(storage);
    first.infoPanel.tabShow('issues');
    expect(first.stateStore.getState().infoPanelTabId).toBe('issues');
    first.infoPanel.dispose();
    const second = shellInfoPanelTestCreate(storage);
    expect(second.infoPanel.activeTabIdRead()).toBe('issues');
    expect(second.infoPanel.slotRead('issues').isConnected).toBe(true);
  });

  it('puts the strip summary slot after the tab buttons and hides the pages while folded', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    const strip = infoPanel.stripElementRead();
    expect(strip.lastElementChild).toBe(infoPanel.stripSummarySlotRead());
    infoPanel.collapsedApply(true);
    expect(infoPanel.isCollapsedShown()).toBe(true);
    expect(infoPanel.getElement().classList.contains(SHELL_INFO_PANEL_COLLAPSED_CLASS)).toBe(true);
    infoPanel.collapsedApply(false);
    expect(infoPanel.isCollapsedShown()).toBe(false);
  });

  it('reports tab and reveal element clicks with the tab shown before the click', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    const clicks: ShellInfoPanelStripClick[] = [];
    infoPanel.stripClickListenerAdd((click) => clicks.push(click));
    const activeTabId = infoPanel.activeTabIdRead();
    const otherTabId = SHELL_INFO_PANEL_TEST_TAB_IDS.find((tabId) => tabId !== activeTabId) ?? 'issues';
    shellTestInfoPanelTabButtonRead(infoPanel, otherTabId).click();
    const revealElement = document.createElement('span');
    infoPanelStripRevealTabWrite(revealElement, 'console');
    infoPanel.stripSummarySlotRead().appendChild(revealElement);
    revealElement.click();
    infoPanel.stripSummarySlotRead().click();
    expect(clicks).toEqual([
      { tabId: otherTabId, isTabButton: true, wasActiveTab: false },
      { tabId: 'console', isTabButton: false, wasActiveTab: otherTabId === 'console' },
    ]);
  });

  it('throws for slots after dispose', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    infoPanel.dispose();
    expect(infoPanel.getElement().isConnected).toBe(false);
    expect(() => infoPanel.slotRead('console')).toThrow();
  });
});
