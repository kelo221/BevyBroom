import { floatingPanelCenterInBounds, type FloatingPanelRect } from './panel_floating_screen_bounds.js';

/** Gap in CSS pixels between a panel placed beside an element and that element. */
export const FLOATING_PANEL_BESIDE_GAP_PX = 6;

/**
 * Inputs of the beside placement: the element, the fallback bounds and the
 * screen.
 */
export interface FloatingPanelBesidePlacementInput {
  /**
   * Rect of the element the panel opens beside, or null when it is missing or
   * hidden.
   */
  readonly besideRect: FloatingPanelRect | null;
  /** Rect the panel is centered in when it cannot sit beside the element. */
  readonly fallbackBounds: FloatingPanelRect;
  /** Panel width in CSS pixels. */
  readonly panelWidth: number;
  /** Panel height in CSS pixels. */
  readonly panelHeight: number;
  /** Screen width in CSS pixels. */
  readonly screenWidth: number;
  /** Minimum gap between the panel and the screen edges in CSS pixels. */
  readonly screenPaddingPx: number;
  /** Gap between the panel and the element in CSS pixels. */
  readonly gapPx: number;
}

/**
 * Computes where a panel opens beside an element: flush to its right with the
 * gap and top-aligned with it; to its left when the right side does not fit on
 * screen; centered in the fallback bounds when neither side fits or the element
 * is missing.
 *
 * @param input Element rect, fallback bounds, panel size, screen width and
 *   gaps.
 * @returns Unclamped left/top of the panel.
 */
export function floatingPanelBesidePlacementCompute(input: FloatingPanelBesidePlacementInput): {
  left: number;
  top: number;
} {
  const besideRect = input.besideRect;
  if (!besideRect) {
    return floatingPanelCenterInBounds(input.fallbackBounds, input.panelWidth, input.panelHeight);
  }
  const rightSideLeft = besideRect.left + besideRect.width + input.gapPx;
  if (rightSideLeft + input.panelWidth <= input.screenWidth - input.screenPaddingPx) {
    return { left: rightSideLeft, top: besideRect.top };
  }
  const leftSideLeft = besideRect.left - input.gapPx - input.panelWidth;
  if (leftSideLeft >= input.screenPaddingPx) {
    return { left: leftSideLeft, top: besideRect.top };
  }
  return floatingPanelCenterInBounds(input.fallbackBounds, input.panelWidth, input.panelHeight);
}

/**
 * Reads the rect of the element a panel opens beside.
 *
 * @param element Element, or null when there is none.
 * @returns Its rect, or null when the element is missing, detached or has no
 *   size.
 */
export function floatingPanelBesideRectRead(element: HTMLElement | null): FloatingPanelRect | null {
  if (!element || !element.isConnected) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
