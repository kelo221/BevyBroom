import { Theme } from '@/theme.js';

/** Data attribute set to `true` on the viewport pane that has focus. */
export const VIEWPORT_FOCUS_FRAME_ATTRIBUTE = 'data-viewport-focused';

/** Id of the style element holding the focus frame rule. */
const VIEWPORT_FOCUS_FRAME_STYLE_ID = 'bevybroom-viewport-focus-frame-styles';

/**
 * Injects the rule that draws a thin frame over the focused pane, above the
 * pane content and without catching pointer events.
 *
 * @param ownerDocument Document that holds the viewport panes.
 */
export function viewportFocusFrameStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(VIEWPORT_FOCUS_FRAME_STYLE_ID)) {
    return;
  }
  const style = ownerDocument.createElement('style');
  style.id = VIEWPORT_FOCUS_FRAME_STYLE_ID;
  style.textContent = `[${VIEWPORT_FOCUS_FRAME_ATTRIBUTE}="true"]::after { content: ''; position: absolute; inset: 0; border: 1px solid ${Theme.viewportFocusBorderColor}; pointer-events: none; z-index: 40; }`;
  ownerDocument.head.appendChild(style);
}

/**
 * Marks exactly one pane as focused so it shows the focus frame.
 *
 * @param paneElements Viewport pane containers in pane order.
 * @param focusedIndex Index of the focused pane; out of range clears every
 *   frame.
 */
export function viewportFocusFrameApply(paneElements: readonly HTMLElement[], focusedIndex: number): void {
  paneElements.forEach((element, index) => {
    viewportFocusFrameStylesEnsure(element.ownerDocument);
    if (index === focusedIndex) {
      element.setAttribute(VIEWPORT_FOCUS_FRAME_ATTRIBUTE, 'true');
      return;
    }
    element.removeAttribute(VIEWPORT_FOCUS_FRAME_ATTRIBUTE);
  });
}
