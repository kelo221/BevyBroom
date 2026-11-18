import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import { TabBook } from '@/ui/tabs/tab_book.js';
import {
  BROWSER_TAB_IDS,
  BROWSER_TAB_LABELS,
  type BrowserTabId,
  type BrowserTabOpenChangeListener,
  type BrowserTabPage,
} from '@/browser/browser_tab.js';

/**
 * The Browser window: one floating, dockable window whose tabs hold the things
 * a mapper picks from (Place, Textures, Levels). Each tab can be opened
 * directly, and a tab counts as open only while the window is open on it.
 */
export class PanelFloatingBrowser extends PanelFloatingContentHost {
  private readonly tabBook: TabBook;
  private readonly pages: Map<BrowserTabId, BrowserTabPage>;
  private readonly tabOpenChangeListeners: Set<BrowserTabOpenChangeListener>;
  private openTabIdLast: BrowserTabId | null;

  /**
   * Creates the Browser window with one tab per page.
   *
   * @param host Parent element of floating windows.
   * @param pages Tab contents in the order the tabs are shown; the first one is
   *   active.
   */
  constructor(host: HTMLElement, pages: readonly BrowserTabPage[]) {
    const tabBook = new TabBook({ ariaLabel: 'Browser', ownerDocument: host.ownerDocument });
    super(host, PanelFloatingBrowser.hostOptionsBuild(), tabBook.getElement());
    this.tabBook = tabBook;
    this.pages = new Map(pages.map((page) => [page.tabId, page]));
    this.tabOpenChangeListeners = new Set();
    this.openTabIdLast = null;
    this.tabBookFill(pages);
    this.tabBook.tabChangeListenerAdd(() => this.openTabRefresh());
    this.openChangeListenerAdd(() => this.openTabRefresh());
  }

  /**
   * Opens the window on a tab.
   *
   * @param tabId Tab to show.
   */
  tabReveal(tabId: BrowserTabId): void {
    this.tabBook.tabShow(tabId);
    this.show();
  }

  /**
   * Closes the window when it is open on the tab, otherwise opens it on the
   * tab.
   *
   * @param tabId Tab to toggle.
   */
  tabToggle(tabId: BrowserTabId): void {
    if (this.isTabOpen(tabId)) {
      this.hide();
      return;
    }
    this.tabReveal(tabId);
  }

  /**
   * Tells whether the window is open and showing the tab.
   *
   * @param tabId Tab to check.
   * @returns True while the tab is visible.
   */
  isTabOpen(tabId: BrowserTabId): boolean {
    return this.isOpen() && this.tabBook.getActiveTabId() === tabId;
  }

  /**
   * Returns the tab the window shows, open or not.
   *
   * @returns Active tab id, or null when the window has no tabs.
   */
  activeTabIdRead(): BrowserTabId | null {
    const activeTabId = this.tabBook.getActiveTabId();
    return BROWSER_TAB_IDS.find((tabId) => tabId === activeTabId) ?? null;
  }

  /**
   * Returns the tab book holding the tabs.
   *
   * @returns Tab book of the window.
   */
  tabBookRead(): TabBook {
    return this.tabBook;
  }

  /**
   * Registers a listener told when a tab starts or stops being visible.
   *
   * @param listener Listener receiving the tab id and whether it is visible
   *   now.
   * @returns Function that removes the listener.
   */
  tabOpenChangeListenerAdd(listener: BrowserTabOpenChangeListener): () => void {
    this.tabOpenChangeListeners.add(listener);
    return () => {
      this.tabOpenChangeListeners.delete(listener);
    };
  }

  /** Removes the window, its tabs and its listeners. */
  override dispose(): void {
    this.tabOpenChangeListeners.clear();
    this.tabBook.dispose();
    super.dispose();
  }

  /**
   * Builds the floating window options of the Browser.
   *
   * @returns Content host options.
   */
  private static hostOptionsBuild(): ConstructorParameters<typeof PanelFloatingContentHost>[1] {
    return {
      titleText: 'Browser',
      className: 'panel-floating-browser',
      width: '380px',
      height: '600px',
      corner: 'bottom-right',
      centered: true,
      layoutId: 'browser',
      layoutRestoresOpen: true,
    };
  }

  /**
   * Adds one tab per page to the tab book and mounts every page.
   *
   * @param pages Tab contents in tab order.
   */
  private tabBookFill(pages: readonly BrowserTabPage[]): void {
    pages.forEach((page) =>
      this.tabBook.tabAdd({ id: page.tabId, label: BROWSER_TAB_LABELS[page.tabId], pageResolve: () => page.element }),
    );
    this.tabBook.pagesMountAll();
  }

  /**
   * Works out which tab is visible now and tells listeners and the page when it
   * changed.
   */
  private openTabRefresh(): void {
    const openTabId = this.isOpen() ? this.activeTabIdRead() : null;
    const closedTabId = this.openTabIdLast;
    if (openTabId === closedTabId) {
      return;
    }
    this.openTabIdLast = openTabId;
    if (closedTabId !== null) {
      this.tabOpenChangeNotify(closedTabId, false);
    }
    if (openTabId !== null) {
      this.pages.get(openTabId)?.onShown?.();
      this.tabOpenChangeNotify(openTabId, true);
    }
  }

  /**
   * Tells every tab listener about one tab.
   *
   * @param tabId Tab whose visibility changed.
   * @param isOpen Whether the tab is visible now.
   */
  private tabOpenChangeNotify(tabId: BrowserTabId, isOpen: boolean): void {
    this.tabOpenChangeListeners.forEach((listener) => listener(tabId, isOpen));
  }
}
