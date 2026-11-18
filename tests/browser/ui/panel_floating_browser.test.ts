import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BROWSER_TAB_IDS, BROWSER_TAB_LABELS, type BrowserTabId } from '@/browser/browser_tab.js';
import { PanelFloatingBrowser } from '@/browser/ui/panel_floating_browser.js';
import { BrowserTabWindow } from '@/browser/ui/browser_tab_window.js';

/** Browser window, its host, one page element and one shown-spy per tab. */
interface BrowserTestRig {
  readonly browser: PanelFloatingBrowser;
  readonly host: HTMLElement;
  readonly pageElements: Record<BrowserTabId, HTMLElement>;
  readonly shownSpies: Record<BrowserTabId, Mock<() => void>>;
}

/** Rigs built by the running test. */
const browserTestRigs: BrowserTestRig[] = [];

/**
 * Builds a Browser window over one fresh page element per tab.
 *
 * @returns Test rig.
 */
function browserTestRigCreate(): BrowserTestRig {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const pageElements = {} as Record<BrowserTabId, HTMLElement>;
  const shownSpies = {} as Record<BrowserTabId, Mock<() => void>>;
  for (const tabId of BROWSER_TAB_IDS) {
    pageElements[tabId] = document.createElement('div');
    shownSpies[tabId] = vi.fn<() => void>();
  }
  const pages = BROWSER_TAB_IDS.map((tabId) => ({
    tabId,
    element: pageElements[tabId],
    onShown: shownSpies[tabId],
  }));
  const rig = { browser: new PanelFloatingBrowser(host, pages), host, pageElements, shownSpies };
  browserTestRigs.push(rig);
  return rig;
}

/**
 * Reads the visible tab labels of the Browser's tab strip.
 *
 * @param browser Browser window.
 * @returns Labels in strip order.
 */
function tabLabelsRead(browser: PanelFloatingBrowser): string[] {
  const buttons = browser.tabBookRead().getStripElement().querySelectorAll('button');
  return [...buttons].map((button) => button.textContent ?? '');
}

afterEach(() => {
  browserTestRigs.splice(0).forEach((rig) => rig.browser.dispose());
  document.body.replaceChildren();
});

describe('PanelFloatingBrowser', () => {
  it('is one window titled Browser with the Place, Textures and Levels tabs in that order', () => {
    const { browser, host } = browserTestRigCreate();
    browser.show();
    expect(host.querySelectorAll('.panel-floating-browser')).toHaveLength(1);
    expect(host.querySelector('.panel-floating-browser')?.textContent ?? '').toContain('Browser');
    expect(tabLabelsRead(browser)).toEqual(BROWSER_TAB_IDS.map((tabId) => BROWSER_TAB_LABELS[tabId]));
    expect(tabLabelsRead(browser)).toEqual(['Place', 'Textures', 'Levels']);
  });

  it('opens on the requested tab and keeps every page inside the one window', () => {
    const { browser, pageElements } = browserTestRigCreate();
    for (const tabId of BROWSER_TAB_IDS) {
      browser.tabReveal(tabId);
      expect(browser.isOpen()).toBe(true);
      expect(browser.activeTabIdRead()).toBe(tabId);
      expect(browser.bodyRead().contains(pageElements[tabId])).toBe(true);
    }
  });

  it('counts a tab as open only while the window is open on it', () => {
    const { browser } = browserTestRigCreate();
    expect(browser.isTabOpen('textures')).toBe(false);
    browser.tabReveal('textures');
    expect(browser.isTabOpen('textures')).toBe(true);
    expect(browser.isTabOpen('place')).toBe(false);
    browser.hide();
    expect(browser.isTabOpen('textures')).toBe(false);
  });

  it('switches tabs when toggling another tab and closes when toggling the shown tab', () => {
    const { browser } = browserTestRigCreate();
    browser.tabToggle('levels');
    expect(browser.isTabOpen('levels')).toBe(true);
    browser.tabToggle('place');
    expect(browser.isOpen()).toBe(true);
    expect(browser.isTabOpen('place')).toBe(true);
    browser.tabToggle('place');
    expect(browser.isOpen()).toBe(false);
  });

  it('calls a page back each time its tab becomes visible, not while it stays visible', () => {
    const { browser, shownSpies } = browserTestRigCreate();
    browser.tabReveal('place');
    browser.tabReveal('place');
    browser.hide();
    browser.tabReveal('place');
    browser.tabReveal('levels');
    expect(shownSpies.place).toHaveBeenCalledTimes(2);
    expect(shownSpies.levels).toHaveBeenCalledTimes(1);
    expect(shownSpies.textures).not.toHaveBeenCalled();
  });

  it('tells listeners which tab stopped and which tab started being visible', () => {
    const { browser } = browserTestRigCreate();
    const changes: Array<[BrowserTabId, boolean]> = [];
    browser.tabOpenChangeListenerAdd((tabId, isOpen) => changes.push([tabId, isOpen]));
    browser.tabReveal('textures');
    browser.tabReveal('levels');
    browser.hide();
    expect(changes).toEqual([
      ['textures', true],
      ['textures', false],
      ['levels', true],
      ['levels', false],
    ]);
  });

  it('opens on the tab a user clicks in the tab strip', () => {
    const { browser } = browserTestRigCreate();
    browser.tabReveal('place');
    browser.tabBookRead().tabButtonRead('levels')?.click();
    expect(browser.isTabOpen('levels')).toBe(true);
  });
});

describe('BrowserTabWindow', () => {
  it('opens, reports and closes the Browser on its own tab only', () => {
    const { browser } = browserTestRigCreate();
    const texturesTab = new BrowserTabWindow(browser, 'textures');
    const levelsTab = new BrowserTabWindow(browser, 'levels');
    texturesTab.toggle();
    expect(texturesTab.isOpen()).toBe(true);
    expect(levelsTab.isOpen()).toBe(false);
    levelsTab.hide();
    expect(browser.isOpen()).toBe(true);
    levelsTab.show();
    expect(texturesTab.isOpen()).toBe(false);
    levelsTab.toggle();
    expect(browser.isOpen()).toBe(false);
  });

  it('tells its listener only about its own tab', () => {
    const { browser } = browserTestRigCreate();
    const placeTab = new BrowserTabWindow(browser, 'place');
    const placeChanges: boolean[] = [];
    const unsubscribe = placeTab.openChangeListenerAdd((isOpen) => placeChanges.push(isOpen));
    browser.tabReveal('textures');
    browser.tabReveal('place');
    browser.tabReveal('levels');
    unsubscribe();
    browser.tabReveal('place');
    expect(placeChanges).toEqual([true, false]);
  });
});
