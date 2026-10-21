import { TabBook } from '@/ui/tabs/tab_book.js';
import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** One tab of a tabbed dock: its id, its label and its keyboard tooltip. */
export interface ShellDockTabDefinition {
  readonly id: string;
  readonly label: string;
  readonly tooltip?: string;
}

/**
 * A docked panel made of named tabs, each with its own page element. Pages stay
 * mounted while hidden so their contents keep scroll position and state.
 */
export class ShellDockTabbed {
  private readonly tabBook: TabBook;
  private readonly pages: Map<string, HTMLElement>;

  /**
   * Creates a tabbed dock and shows the requested tab, or the first tab when
   * the requested id is unknown.
   *
   * @param ariaLabel Accessible name of the tab strip.
   * @param tabs Tabs in display order.
   * @param initialTabId Tab shown first.
   */
  constructor(ariaLabel: string, tabs: readonly ShellDockTabDefinition[], initialTabId: string) {
    this.tabBook = new TabBook({ ariaLabel, variant: 'underline', pageRetention: 'mounted' });
    this.pages = new Map();
    tabs.forEach((tab) => this.tabRegister(tab));
    this.tabShow(initialTabId);
    this.tabBook.pagesMountAll();
    this.rootStyle();
  }

  /**
   * Returns the dock root element.
   *
   * @returns Root element holding the tab strip and pages.
   */
  getElement(): HTMLElement {
    return this.tabBook.getElement();
  }

  /**
   * Returns the page element of one tab.
   *
   * @param tabId Tab id.
   * @returns Page element, or null for an unknown tab.
   */
  pageRead(tabId: string): HTMLElement | null {
    return this.pages.get(tabId) ?? null;
  }

  /**
   * Shows one tab.
   *
   * @param tabId Tab id.
   * @returns True when the tab exists.
   */
  tabShow(tabId: string): boolean {
    if (!this.pages.has(tabId)) {
      return false;
    }
    this.tabBook.tabShow(tabId);
    return true;
  }

  /**
   * Returns the id of the shown tab.
   *
   * @returns Shown tab id, or null before any tab exists.
   */
  activeTabIdRead(): string | null {
    return this.tabBook.getActiveTabId();
  }

  /**
   * Registers a listener told the id of each newly shown tab.
   *
   * @param listener Called with the shown tab id.
   * @returns Function that removes the listener.
   */
  tabChangeListenerAdd(listener: (tabId: string) => void): () => void {
    return this.tabBook.tabChangeListenerAdd(listener);
  }

  /** Removes the dock and its pages from the document. */
  dispose(): void {
    this.tabBook.dispose();
    this.pages.clear();
  }

  /**
   * Creates the page of one tab and adds the tab.
   *
   * @param tab Tab definition.
   */
  private tabRegister(tab: ShellDockTabDefinition): void {
    const page = document.createElement('div');
    page.classList.add('shell-dock-page', `shell-dock-page-${tab.id}`);
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
    page.style.height = '100%';
    page.style.minHeight = '0';
    page.style.overflow = 'hidden';
    this.pages.set(tab.id, page);
    this.tabBook.tabAdd({ id: tab.id, label: tab.label, pageResolve: () => page, ...this.tooltipPart(tab) });
  }

  /**
   * Returns the optional tooltip part of a tab definition.
   *
   * @param tab Tab definition.
   * @returns Object with the tooltip, or an empty object.
   */
  private tooltipPart(tab: ShellDockTabDefinition): { tooltip?: string } {
    return tab.tooltip === undefined ? {} : { tooltip: tab.tooltip };
  }

  /** Fills the parent pane with the dock and paints the panel background. */
  private rootStyle(): void {
    const root = this.tabBook.getElement();
    root.style.flex = '1 1 auto';
    root.style.minHeight = '0';
    root.style.minWidth = '0';
    root.style.background = hexToRgb(Theme.propertiesPanelBackground);
  }
}
