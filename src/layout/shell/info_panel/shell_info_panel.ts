import { ShellDockTabbed, type ShellDockTabDefinition } from '@/layout/shell/dock/shell_dock_tabbed.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';

/** Ids of the info panel tabs. */
export type ShellInfoPanelTabId = 'console' | 'issues';

/** Info panel tabs in display order. */
export const SHELL_INFO_PANEL_TABS: readonly ShellDockTabDefinition[] = [
  { id: 'console', label: 'Console' },
  { id: 'issues', label: 'Issues' },
];

/** Bottom info panel with Console and Issues tabs. */
export class ShellInfoPanel extends ShellDockTabbed {
  /**
   * Creates the info panel and restores its shown tab.
   *
   * @param stateStore Store that keeps the shown tab.
   */
  constructor(stateStore: ShellStateStore) {
    super('Info panel', SHELL_INFO_PANEL_TABS, stateStore.getState().infoPanelTabId);
    this.tabChangeListenerAdd((tabId) => stateStore.update({ infoPanelTabId: tabId }));
    this.getElement().classList.add('shell-info-panel');
  }

  /**
   * Returns the page a view is mounted into.
   *
   * @param tabId Info panel tab.
   * @returns Page element.
   */
  slotRead(tabId: ShellInfoPanelTabId): HTMLElement {
    const page = this.pageRead(tabId);
    if (!page) {
      throw new Error(`Unknown info panel tab ${tabId}`);
    }
    return page;
  }
}
