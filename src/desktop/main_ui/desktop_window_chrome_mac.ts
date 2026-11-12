/** Value of the root data attribute that marks the inset macOS title bar. */
export const DESKTOP_WINDOW_CHROME_MAC_INSET = 'mac_inset';

/** Id of the style element that lays the page out under the inset title bar. */
export const DESKTOP_WINDOW_CHROME_MAC_STYLE_ELEMENT_ID = 'desktop-window-chrome-mac';

/** Width kept free on the left of the top row for the window buttons, in pixels. */
export const DESKTOP_WINDOW_CHROME_MAC_TRAFFIC_LIGHT_INSET_PX = 78;

/** Root selector that scopes the rules to the inset macOS title bar. */
const DESKTOP_WINDOW_CHROME_MAC_ROOT_SELECTOR = `html[data-window-chrome='${DESKTOP_WINDOW_CHROME_MAC_INSET}']`;

/**
 * Controls inside the top row that must stay clickable instead of dragging the
 * window.
 */
const DESKTOP_WINDOW_CHROME_MAC_NO_DRAG_SELECTORS = ['button', 'input', 'select', 'textarea', 'a', '[role="button"]'];

/**
 * Builds the stylesheet that turns the top toolbar row into the window title
 * bar: free space for the window buttons and a drag region outside controls.
 *
 * @returns CSS text.
 */
export function desktopWindowChromeMacStylesheetBuild(): string {
  const root = DESKTOP_WINDOW_CHROME_MAC_ROOT_SELECTOR;
  const noDragSelectors = DESKTOP_WINDOW_CHROME_MAC_NO_DRAG_SELECTORS.map(
    (selector) => `${root} .shell-toolbar-host ${selector}`,
  ).join(', ');
  return [
    `${root} .shell-toolbar-host { padding-left: ${DESKTOP_WINDOW_CHROME_MAC_TRAFFIC_LIGHT_INSET_PX}px !important; -webkit-app-region: drag; app-region: drag; }`,
    `${noDragSelectors} { -webkit-app-region: no-drag; app-region: no-drag; }`,
  ].join('\n');
}

/**
 * Marks the page as running under the inset macOS title bar and adds the
 * stylesheet that makes room for the window buttons.
 *
 * @param targetDocument Desktop page document.
 */
export function desktopWindowChromeMacInstall(targetDocument: Document): void {
  targetDocument.documentElement.dataset['windowChrome'] = DESKTOP_WINDOW_CHROME_MAC_INSET;
  if (targetDocument.getElementById(DESKTOP_WINDOW_CHROME_MAC_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = targetDocument.createElement('style');
  styleElement.id = DESKTOP_WINDOW_CHROME_MAC_STYLE_ELEMENT_ID;
  styleElement.textContent = desktopWindowChromeMacStylesheetBuild();
  targetDocument.head.appendChild(styleElement);
}
