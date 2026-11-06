import { ShellDockTabbed, type ShellDockTabDefinition } from '@/layout/shell/dock/shell_dock_tabbed.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { infoPanelStripRevealTabRead } from '@/info_panel/strip/info_panel_strip_reveal.js';
import {
  SHELL_INFO_PANEL_CLASS,
  SHELL_INFO_PANEL_COLLAPSED_CLASS,
  SHELL_INFO_PANEL_STRIP_SUMMARY_CLASS,
  shellInfoPanelStylesEnsure,
} from './shell_info_panel_styles.js';

/** Ids of the info panel tabs. */
export type ShellInfoPanelTabId = 'console' | 'issues';

/** Info panel tab ids in display order. */
export const SHELL_INFO_PANEL_TAB_IDS: readonly ShellInfoPanelTabId[] = ['console', 'issues'];

/** Info panel tabs in display order. */
export const SHELL_INFO_PANEL_TABS: readonly ShellDockTabDefinition[] = [
  { id: 'console', label: 'Console' },
  { id: 'issues', label: 'Issues' },
];

/** What a click in the info panel strip asks for. */
export interface ShellInfoPanelStripClick {
  /** Tab the click is about. */
  readonly tabId: ShellInfoPanelTabId;
  /**
   * True when a tab button was clicked, false for an element that reveals a
   * tab.
   */
  readonly isTabButton: boolean;
  /** True when that tab was already shown before the click. */
  readonly wasActiveTab: boolean;
}

/** Listener told about every click on a tab or a revealing element of the strip. */
export type ShellInfoPanelStripClickListener = (click: ShellInfoPanelStripClick) => void;

/**
 * Bottom info panel with Console and Issues tabs on a one-line strip that also
 * holds a summary part, and that can fold to that strip alone.
 */
export class ShellInfoPanel extends ShellDockTabbed {
  private readonly stripSummarySlot: HTMLElement;
  private readonly stripClickListeners: Set<ShellInfoPanelStripClickListener>;

  /**
   * Creates the info panel and restores its shown tab.
   *
   * @param stateStore Store that keeps the shown tab.
   */
  constructor(stateStore: ShellStateStore) {
    super('Info panel', SHELL_INFO_PANEL_TABS, stateStore.getState().infoPanelTabId);
    this.stripClickListeners = new Set();
    this.tabChangeListenerAdd((tabId) => stateStore.update({ infoPanelTabId: tabId }));
    shellInfoPanelStylesEnsure(this.getElement().ownerDocument);
    this.getElement().classList.add(SHELL_INFO_PANEL_CLASS);
    this.stripSummarySlot = this.stripSummarySlotCreate();
    this.stripElementRead().addEventListener('click', (event) => this.stripClickDispatch(event), true);
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

  /**
   * Returns the strip part after the tabs that a summary view is mounted into.
   *
   * @returns Strip summary slot.
   */
  stripSummarySlotRead(): HTMLElement {
    return this.stripSummarySlot;
  }

  /**
   * Shows only the strip, or the strip with the shown page below it.
   *
   * @param collapsed True to show only the strip.
   */
  collapsedApply(collapsed: boolean): void {
    this.getElement().classList.toggle(SHELL_INFO_PANEL_COLLAPSED_CLASS, collapsed);
  }

  /**
   * Returns whether only the strip is shown.
   *
   * @returns True while folded to the strip.
   */
  isCollapsedShown(): boolean {
    return this.getElement().classList.contains(SHELL_INFO_PANEL_COLLAPSED_CLASS);
  }

  /**
   * Registers a listener told about clicks on the tabs and on strip elements
   * that reveal a tab. It runs before the clicked tab is shown.
   *
   * @param listener Called with the click.
   * @returns Function that removes the listener.
   */
  stripClickListenerAdd(listener: ShellInfoPanelStripClickListener): () => void {
    this.stripClickListeners.add(listener);
    return () => {
      this.stripClickListeners.delete(listener);
    };
  }

  /** Removes the panel and drops its strip listeners. */
  override dispose(): void {
    this.stripClickListeners.clear();
    super.dispose();
  }

  /**
   * Creates the strip summary slot after the tab buttons.
   *
   * @returns Strip summary slot.
   */
  private stripSummarySlotCreate(): HTMLElement {
    const slot = this.getElement().ownerDocument.createElement('div');
    slot.classList.add(SHELL_INFO_PANEL_STRIP_SUMMARY_CLASS);
    this.stripElementRead().appendChild(slot);
    return slot;
  }

  /**
   * Tells the strip click listeners about a click on a tab or a revealing
   * element.
   *
   * @param event Click event seen while it travels down to its target.
   */
  private stripClickDispatch(event: Event): void {
    const click = event.target instanceof Element ? this.stripClickResolve(event.target) : null;
    if (click !== null) {
      this.stripClickListeners.forEach((listener) => listener(click));
    }
  }

  /**
   * Works out which tab a strip click is about.
   *
   * @param target Clicked element.
   * @returns The click, or null when it hit neither a tab nor a revealing
   *   element.
   */
  private stripClickResolve(target: Element): ShellInfoPanelStripClick | null {
    const tabButton = target.closest<HTMLElement>('[role="tab"]');
    const candidate = tabButton?.dataset['tabId'] ?? infoPanelStripRevealTabRead(target);
    const tabId = SHELL_INFO_PANEL_TAB_IDS.find((known) => known === candidate);
    if (tabId === undefined) {
      return null;
    }
    return { tabId, isTabButton: tabButton !== null, wasActiveTab: this.activeTabIdRead() === tabId };
  }
}
