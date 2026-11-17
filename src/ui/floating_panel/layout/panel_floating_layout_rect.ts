/** Position and size of a floating window in CSS pixels. */
export interface PanelFloatingLayoutRect {
  /** Left edge in client pixels. */
  readonly left: number;
  /** Top edge in client pixels. */
  readonly top: number;
  /** Outer width. */
  readonly width: number;
  /** Outer height. */
  readonly height: number;
}

/** Smallest width a floating window can be resized to in CSS pixels. */
export const PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX = 160;

/** Smallest height a floating window can be resized to in CSS pixels. */
export const PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX = 90;

/**
 * Returns a rect read from an unknown value, or null when it is not a rect with
 * finite numbers and a usable size.
 *
 * @param value Value to read, for example parsed saved state.
 * @returns Rect, or null.
 */
export function panelFloatingLayoutRectRead(value: unknown): PanelFloatingLayoutRect | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const numbers = [record['left'], record['top'], record['width'], record['height']];
  if (!numbers.every((part) => typeof part === 'number' && Number.isFinite(part))) {
    return null;
  }
  const [left, top, width, height] = numbers as number[];
  if ((width ?? 0) < PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX || (height ?? 0) < PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX) {
    return null;
  }
  return { left: left ?? 0, top: top ?? 0, width: width ?? 0, height: height ?? 0 };
}

/**
 * Returns the rect an element covers on screen.
 *
 * @param element Element to measure.
 * @returns Its client rect.
 */
export function panelFloatingLayoutRectOf(element: HTMLElement): PanelFloatingLayoutRect {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
