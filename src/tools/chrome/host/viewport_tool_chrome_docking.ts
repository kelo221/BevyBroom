/**
 * Where docked tool chrome goes: the tool buttons rail and the tool options
 * strip each get their own parent, typically the left tools palette and the
 * view bar.
 */
export interface ViewportToolChromeDocking {
  /** Parent that receives the vertical tool buttons rail. */
  readonly railParent: HTMLElement;
  /** Parent that receives the tool options strip. */
  readonly optionsParent: HTMLElement;
}

/** CSS class added to tool chrome strips that sit inline in a bar. */
export const VIEWPORT_TOOL_CHROME_DOCKED_CLASS = 'editor-viewport-tool-chrome-docked';

/**
 * Restyles a tool chrome strip so it sits inline in a bar: a horizontal row
 * without floating position, border, radius or shadow.
 *
 * @param strip Rail or options strip root element.
 */
export function viewportToolChromeDockedStripStyle(strip: HTMLElement): void {
  viewportToolChromeDockedBaseStyle(strip);
  strip.style.width = 'auto';
  strip.style.flexDirection = 'row';
  strip.style.flexWrap = 'nowrap';
  strip.style.padding = '0 2px';
}

/**
 * Restyles the tool buttons rail so it fills a docked vertical palette: a
 * full-width column of centered buttons without floating position, border,
 * radius or shadow.
 *
 * @param element Rail root element.
 */
export function viewportToolChromeDockedRailStyle(element: HTMLElement): void {
  viewportToolChromeDockedBaseStyle(element);
  element.style.display = 'flex';
  element.style.width = '100%';
  element.style.flexDirection = 'column';
  element.style.flexWrap = 'nowrap';
  element.style.gap = '4px';
  element.style.padding = '0';
}

/**
 * Removes floating position, size limits, background, border, radius, shadow
 * and stacking from a docked chrome element and centers its items.
 *
 * @param element Docked chrome root element.
 */
function viewportToolChromeDockedBaseStyle(element: HTMLElement): void {
  element.classList.add(VIEWPORT_TOOL_CHROME_DOCKED_CLASS);
  element.style.position = 'static';
  element.style.left = '';
  element.style.top = '';
  element.style.maxWidth = 'none';
  element.style.alignItems = 'center';
  element.style.background = 'transparent';
  element.style.border = 'none';
  element.style.borderRadius = '0';
  element.style.boxShadow = 'none';
  element.style.zIndex = '';
}
