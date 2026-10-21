import { afterEach, describe, expect, it } from 'vitest';
import {
  SHELL_INFO_PANEL_TABS,
  ShellInfoPanel,
  type ShellInfoPanelTabId,
} from '@/layout/shell/info_panel/shell_info_panel.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellStateDefaultCreate } from '@/layout/shell/state/shell_state.js';
import { shellTestStorageCreate } from '../shell_test_support.js';

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

  it('throws for slots after dispose', () => {
    const { infoPanel } = shellInfoPanelTestCreate(shellTestStorageCreate());
    infoPanel.dispose();
    expect(infoPanel.getElement().isConnected).toBe(false);
    expect(() => infoPanel.slotRead('console')).toThrow();
  });
});
