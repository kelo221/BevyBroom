import type { ShellFloatingWindow } from '@/layout/shell/actions/shell_floating_window.js';
import type { BrowserTabId } from '@/browser/browser_tab.js';
import type { PanelFloatingBrowser } from './panel_floating_browser.js';

/**
 * One tab of the Browser window seen as a window of its own: toggling it opens
 * the Browser on the tab or closes it, and it counts as open only while the
 * Browser shows the tab.
 */
export class BrowserTabWindow implements ShellFloatingWindow {
  private readonly browser: PanelFloatingBrowser;
  private readonly tabId: BrowserTabId;

  /**
   * Creates the window view of one Browser tab.
   *
   * @param browser Browser window holding the tab.
   * @param tabId Tab this view stands for.
   */
  constructor(browser: PanelFloatingBrowser, tabId: BrowserTabId) {
    this.browser = browser;
    this.tabId = tabId;
  }

  /** Closes the Browser when it shows the tab, otherwise opens it on the tab. */
  toggle(): void {
    this.browser.tabToggle(this.tabId);
  }

  /** Opens the Browser on the tab. */
  show(): void {
    this.browser.tabReveal(this.tabId);
  }

  /** Closes the Browser when it shows the tab. */
  hide(): void {
    if (this.isOpen()) {
      this.browser.hide();
    }
  }

  /**
   * Tells whether the Browser is open on the tab.
   *
   * @returns True while the tab is visible.
   */
  isOpen(): boolean {
    return this.browser.isTabOpen(this.tabId);
  }

  /**
   * Registers a listener told when the tab starts or stops being visible.
   *
   * @param listener Listener receiving whether the tab is visible now.
   * @returns Function that removes the listener.
   */
  openChangeListenerAdd(listener: (isOpen: boolean) => void): () => void {
    return this.browser.tabOpenChangeListenerAdd((tabId, isOpen) => {
      if (tabId === this.tabId) {
        listener(isOpen);
      }
    });
  }
}
