/**
 * Attribute that makes a strip element unfold the info panel on the tab it
 * names when clicked.
 */
export const INFO_PANEL_STRIP_REVEAL_TAB_ATTRIBUTE = 'data-info-panel-reveal-tab';

/**
 * Marks an element so that clicking it unfolds the info panel on one tab.
 *
 * @param element Element inside the info panel strip.
 * @param tabId Id of the tab to show.
 */
export function infoPanelStripRevealTabWrite(element: HTMLElement, tabId: string): void {
  element.setAttribute(INFO_PANEL_STRIP_REVEAL_TAB_ATTRIBUTE, tabId);
}

/**
 * Returns the tab a clicked element or its nearest marked ancestor reveals.
 *
 * @param target Click target.
 * @returns Tab id, or null when no marked element was clicked.
 */
export function infoPanelStripRevealTabRead(target: Element): string | null {
  const marked = target.closest(`[${INFO_PANEL_STRIP_REVEAL_TAB_ATTRIBUTE}]`);
  return marked?.getAttribute(INFO_PANEL_STRIP_REVEAL_TAB_ATTRIBUTE) ?? null;
}
