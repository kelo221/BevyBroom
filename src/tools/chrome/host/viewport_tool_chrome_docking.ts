/**
 * Where docked tool chrome goes: the tool buttons strip and the tool options
 * strip each get their own parent, typically the main toolbar and the view
 * bar.
 */
export interface ViewportToolChromeDocking {
  /** Parent that receives the tool buttons strip. */
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
  strip.classList.add(VIEWPORT_TOOL_CHROME_DOCKED_CLASS);
  strip.style.position = 'static';
  strip.style.left = '';
  strip.style.top = '';
  strip.style.width = 'auto';
  strip.style.maxWidth = 'none';
  strip.style.flexDirection = 'row';
  strip.style.flexWrap = 'nowrap';
  strip.style.alignItems = 'center';
  strip.style.padding = '0 2px';
  strip.style.background = 'transparent';
  strip.style.border = 'none';
  strip.style.borderRadius = '0';
  strip.style.boxShadow = 'none';
  strip.style.zIndex = '';
}
