import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';

/** Screen rectangle of one main window area in CSS pixels. */
export interface ShellMainWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Screen rectangles of the main window areas. */
export interface ShellMainWindowLayout {
  /** Map views above the info panel. */
  views: ShellMainWindowBounds;
  /** Bottom Console / Issues panel; zero sized while hidden. */
  infoPanel: ShellMainWindowBounds;
  /** Right-hand inspector; zero sized while hidden. */
  inspector: ShellMainWindowBounds;
}

/**
 * Measures the map views, the info panel and the inspector of a frame.
 *
 * @param frame Main window skeleton to measure.
 * @returns Bounds of the main window areas.
 */
export function shellMainWindowLayoutRead(frame: ShellFrame): ShellMainWindowLayout {
  return {
    views: shellMainWindowBoundsRead(frame.viewsPaneRead()),
    infoPanel: shellMainWindowBoundsRead(frame.infoPanelHostRead()),
    inspector: shellMainWindowBoundsRead(frame.inspectorHostRead()),
  };
}

/**
 * Measures one element in whole CSS pixels.
 *
 * @param element Element to measure.
 * @returns Its screen rectangle.
 */
function shellMainWindowBoundsRead(element: HTMLElement): ShellMainWindowBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
