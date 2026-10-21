import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import type { ViewportPane } from '@/layout/viewport/viewport_pane.js';
import {
  onViewportKindChange,
  toggleMaximizeForPane,
  type LayoutViewportChromeHost,
} from '@/layout/setup/layout_viewport_chrome.js';

/** Order in which the view cycle shortcut steps a pane through view kinds. */
export const VIEW_CYCLE_KIND_ORDER: readonly ViewportKind[] = [
  ViewportKind.PERSPECTIVE,
  ViewportKind.TOP,
  ViewportKind.FRONT,
  ViewportKind.SIDE,
];

/**
 * Returns the view kind that follows the given kind in the view cycle order.
 *
 * @param kind Current view kind of a pane.
 * @returns Next view kind, wrapping from the last back to the first.
 */
export function viewCycleKindNext(kind: ViewportKind): ViewportKind {
  const currentIndex = VIEW_CYCLE_KIND_ORDER.indexOf(kind);
  const nextIndex = (currentIndex + 1) % VIEW_CYCLE_KIND_ORDER.length;
  return VIEW_CYCLE_KIND_ORDER[nextIndex] ?? ViewportKind.PERSPECTIVE;
}

/**
 * Finds the pane whose viewport is under the pointer.
 *
 * @param host Layout chrome host with the registry and the hovered viewport
 *   tracker.
 * @returns Hovered pane, or null when no pane is hovered.
 */
export function viewCycleHoveredPaneFind(host: LayoutViewportChromeHost): ViewportPane | null {
  const coordinator = host.shadingModeCoordinator;
  if (!coordinator) {
    return null;
  }
  const hoveredViewport = coordinator.getOrderedViewports()[coordinator.getActiveViewportIndex()];
  if (!hoveredViewport) {
    return null;
  }
  return host.viewportRegistry.getPanes().find((pane) => pane.getViewport() === hoveredViewport) ?? null;
}

/**
 * Switches the hovered pane to the next view kind and fits the new view to the
 * selection.
 *
 * @param host Layout chrome host.
 * @param viewportFitToSelection Fits one viewport camera to the current
 *   selection.
 * @returns True when a pane changed its view kind.
 */
export function viewCycleHoveredPane(
  host: LayoutViewportChromeHost,
  viewportFitToSelection: (viewport: ViewportEditor) => void,
): boolean {
  const pane = viewCycleHoveredPaneFind(host);
  if (!pane) {
    return false;
  }
  onViewportKindChange(host, pane.getId(), viewCycleKindNext(pane.getKind()));
  const replacedViewport = pane.getViewport();
  if (replacedViewport) {
    viewportFitToSelection(replacedViewport);
  }
  return true;
}

/**
 * Maximizes the hovered pane, or restores the full layout when it is already
 * maximized.
 *
 * @param host Layout chrome host.
 * @returns True when a hovered pane was found and toggled.
 */
export function viewMaximizeHoveredPane(host: LayoutViewportChromeHost): boolean {
  const pane = viewCycleHoveredPaneFind(host);
  if (!pane) {
    return false;
  }
  toggleMaximizeForPane(host, pane.getId());
  return true;
}
