import { ViewportKind, VIEWPORT_KIND_MENU_ORDER, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';

/**
 * Horizontal and vertical screen axes per viewport kind in Y-up coordinates;
 * empty for the perspective view, which has no fixed screen axes.
 */
const VIEWPORT_AXIS_PAIRS: Readonly<Record<ViewportKind, string>> = {
  [ViewportKind.PERSPECTIVE]: '',
  [ViewportKind.TOP]: 'x/z',
  [ViewportKind.FRONT]: 'x/y',
  [ViewportKind.SIDE]: 'z/y',
};

/** Caption of a view without fixed screen axes. */
const VIEWPORT_AXIS_CAPTION_CAMERA = 'camera';

/**
 * Returns the screen axes a viewport kind looks along.
 *
 * @param kind Viewport kind.
 * @returns Axis pair such as "x/z", or an empty string for the perspective
 *   view.
 */
export function viewportAxisPairForKind(kind: ViewportKind): string {
  return VIEWPORT_AXIS_PAIRS[kind];
}

/**
 * Returns the axis caption shown in a viewport corner label.
 *
 * @param kind Viewport kind.
 * @returns Caption such as "top (x/z)" or "camera".
 */
export function viewportAxisCaptionForKind(kind: ViewportKind): string {
  const axisPair = viewportAxisPairForKind(kind);
  if (axisPair === '') {
    return VIEWPORT_AXIS_CAPTION_CAMERA;
  }
  return `${getViewportKindDisplayLabel(kind).toLowerCase()} (${axisPair})`;
}

/**
 * Returns the axis caption for a viewport title that equals a kind display
 * label, such as "Top".
 *
 * @param titleText Viewport title text.
 * @returns Matching caption, or an empty string when no kind uses that label.
 */
export function viewportAxisCaptionForTitle(titleText: string): string {
  const kind = VIEWPORT_KIND_MENU_ORDER.find((candidate) => getViewportKindDisplayLabel(candidate) === titleText);
  return kind === undefined ? '' : viewportAxisCaptionForKind(kind);
}
