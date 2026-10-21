import { describe, expect, it, vi } from 'vitest';
import { TabBook, type TabBookPageRetention } from '@/ui/tabs/tab_book.js';

/**
 * Creates a page element that names its tab.
 *
 * @param tabId Tab id written into the page.
 * @returns Page element.
 */
function pageCreate(tabId: string): HTMLElement {
  const page = document.createElement('div');
  page.dataset['pageOf'] = tabId;
  page.textContent = `page ${tabId}`;
  return page;
}

/**
 * Builds a mounted tab book with the given tab ids.
 *
 * @param tabIds Tab ids added in order.
 * @param pageRetention Page retention mode.
 * @returns Tab book and a spy counting page builds per tab.
 */
function tabBookCreate(
  tabIds: string[],
  pageRetention: TabBookPageRetention,
): { book: TabBook; pageResolveCalls: Map<string, number> } {
  const book = new TabBook({ ariaLabel: 'Test tabs', pageRetention });
  const pageResolveCalls = new Map<string, number>();
  tabIds.forEach((tabId) => {
    book.tabAdd({
      id: tabId,
      label: tabId.toUpperCase(),
      pageResolve: () => {
        pageResolveCalls.set(tabId, (pageResolveCalls.get(tabId) ?? 0) + 1);
        return pageCreate(tabId);
      },
    });
  });
  document.body.appendChild(book.getElement());
  return { book, pageResolveCalls };
}

/**
 * Returns the tab ids whose page is visible in the page host.
 *
 * @param book Tab book to inspect.
 * @returns Ids of pages that are attached and not hidden.
 */
function visiblePageIds(book: TabBook): string[] {
  return [...book.getContentElement().querySelectorAll<HTMLElement>('[data-page-of]')]
    .filter((page) => !page.closest('[hidden]'))
    .map((page) => page.dataset['pageOf'] ?? '');
}

describe('TabBook', () => {
  it('shows the first added tab and marks only its button selected', () => {
    const { book } = tabBookCreate(['map', 'entity', 'face'], 'mounted');
    expect(book.getActiveTabId()).toBe('map');
    const selected = [...book.getStripElement().querySelectorAll('[aria-selected="true"]')];
    expect(selected.map((button) => button.textContent)).toEqual(['MAP']);
    expect(visiblePageIds(book)).toEqual(['map']);
    book.dispose();
  });

  it('switches pages when a tab button is clicked and notifies listeners once', () => {
    const { book } = tabBookCreate(['map', 'entity', 'face'], 'mounted');
    const listener = vi.fn();
    book.tabChangeListenerAdd(listener);
    const faceButton = book.getStripElement().querySelector<HTMLButtonElement>('[data-tab-id="face"]');
    faceButton?.click();
    faceButton?.click();
    expect(book.getActiveTabId()).toBe('face');
    expect(visiblePageIds(book)).toEqual(['face']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('face');
    book.dispose();
  });

  it('builds each page once and keeps it attached in mounted mode', () => {
    const { book, pageResolveCalls } = tabBookCreate(['map', 'entity'], 'mounted');
    const mapPage = book.getContentElement().querySelector('[data-page-of="map"]');
    book.tabShow('entity');
    book.tabShow('map');
    book.tabShow('entity');
    expect(pageResolveCalls.get('map')).toBe(1);
    expect(pageResolveCalls.get('entity')).toBe(1);
    expect(mapPage?.isConnected).toBe(true);
    expect(visiblePageIds(book)).toEqual(['entity']);
    book.dispose();
  });

  it('mounts every page at once with only the active page visible', () => {
    const tabIds = ['map', 'entity', 'face'];
    const { book, pageResolveCalls } = tabBookCreate(tabIds, 'mounted');
    book.pagesMountAll();
    const mountedPageIds = [...book.getContentElement().querySelectorAll<HTMLElement>('[data-page-of]')].map(
      (page) => page.dataset['pageOf'],
    );
    expect(mountedPageIds).toEqual(tabIds);
    expect(visiblePageIds(book)).toEqual([book.getActiveTabId()]);
    book.pagesMountAll();
    tabIds.forEach((tabId) => expect(pageResolveCalls.get(tabId)).toBe(1));
    book.dispose();
  });

  it('keeps only the active page in the document in swapped mode', () => {
    const { book } = tabBookCreate(['games', 'view'], 'swapped');
    book.tabShow('view');
    const attachedPages = book.getContentElement().querySelectorAll('[data-page-of]');
    expect(attachedPages).toHaveLength(1);
    expect(visiblePageIds(book)).toEqual(['view']);
    book.dispose();
  });

  it('ignores unknown tabs and duplicate ids', () => {
    const { book } = tabBookCreate(['map'], 'mounted');
    book.tabAdd({ id: 'map', label: 'Again', pageResolve: () => pageCreate('again') });
    expect(book.tabShow('missing')).toBe(false);
    expect(book.tabIdsList()).toEqual(['map']);
    expect(book.getActiveTabId()).toBe('map');
    book.dispose();
  });

  it('stops notifying a listener after it is removed', () => {
    const { book } = tabBookCreate(['map', 'entity'], 'mounted');
    const listener = vi.fn();
    const remove = book.tabChangeListenerAdd(listener);
    remove();
    book.tabShow('entity');
    expect(listener).not.toHaveBeenCalled();
    book.dispose();
  });
});
