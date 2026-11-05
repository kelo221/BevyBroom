import { ViewportKind, VIEWPORT_KIND_MENU_ORDER, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';

/**
 * Axis caption per viewport kind, naming the horizontal and vertical screen
 * axes in Y-up coordinates.
 */
const VIEWPORT_AXIS_CAPTIONS: Readonly<Record<ViewportKind, string>> = {
  [ViewportKind.PERSPECTIVE]: 'camera',
  [ViewportKind.TOP]: 'top (x/z)',
  [ViewportKind.FRONT]: 'front (x/y)',
  [ViewportKind.SIDE]: 'side (z/y)',
};

/**
 * Returns the axis caption shown next to a viewport title.
 *
 * @param kind Viewport kind.
 * @returns Caption such as "top (x/z)" or "camera".
 */
export function viewportAxisCaptionForKind(kind: ViewportKind): string {
  return VIEWPORT_AXIS_CAPTIONS[kind];
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
