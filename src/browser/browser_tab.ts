/** Tab ids of the Browser window, in the order the tabs are shown. */
export const BROWSER_TAB_IDS = ['place', 'textures', 'levels'] as const;

/** One tab of the Browser window. */
export type BrowserTabId = (typeof BROWSER_TAB_IDS)[number];

/** Tab label shown in the Browser window for each tab. */
export const BROWSER_TAB_LABELS: Readonly<Record<BrowserTabId, string>> = {
  place: 'Place',
  textures: 'Textures',
  levels: 'Levels',
};

/** Content of one Browser tab. */
export interface BrowserTabPage {
  /** Tab the content belongs to. */
  readonly tabId: BrowserTabId;
  /** Element shown while the tab is active. */
  readonly element: HTMLElement;
  /** Called each time the tab becomes the visible tab of the open window. */
  readonly onShown?: () => void;
}

/**
 * Listener told when a tab starts or stops being the visible tab of the open
 * window.
 */
export type BrowserTabOpenChangeListener = (tabId: BrowserTabId, isOpen: boolean) => void;
