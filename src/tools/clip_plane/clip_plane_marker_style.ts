import { Theme } from '@/theme.js';

/**
 * Visual and interaction constants for clip plane placement markers. Sizes are
 * CSS pixels on screen, so markers look the same in every pane and at every
 * zoom. Point colors are distinct so the three plane points stay recognizable
 * across views.
 */

/** Radius of the colored marker core on screen, in CSS pixels. */
export const CLIP_MARKER_CORE_PIXELS = 6;

/** Radius of the light rim around the core on screen, in CSS pixels. */
export const CLIP_MARKER_RIM_PIXELS = 8;

/** Radius of the dark outline around the rim on screen, in CSS pixels. */
export const CLIP_MARKER_HALO_PIXELS = 10;

/** Extra radius of a marker under the pointer, in CSS pixels. */
export const CLIP_MARKER_HOVER_GROWTH_PIXELS = 3;

/** Share of a placed marker's size used for the pointer preview marker. */
export const CLIP_MARKER_PREVIEW_SIZE_SHARE = 0.75;

/** Opacity of the pointer preview marker core. */
export const CLIP_MARKER_PREVIEW_OPACITY = 0.7;

/** Screen-space pick radius in CSS pixels for grabbing a marker. */
export const CLIP_MARKER_PICK_PIXELS = 16;

/** UserData key storing the placement point index on a marker group. */
export const CLIP_MARKER_INDEX_KEY = 'clipPlaneMarkerIndex';

/**
 * Returns the display color for a clip placement point index.
 *
 * @param pointIndex Zero-based point index (0, 1, or 2).
 * @returns Theme hex color for that point.
 */
export function getClipPointColor(pointIndex: number): number {
  if (pointIndex === 0) return Theme.clipPoint1Color;
  if (pointIndex === 1) return Theme.clipPoint2Color;
  return Theme.clipPoint3Color;
}
