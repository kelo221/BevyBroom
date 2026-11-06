import {
  DISPLACEMENT_SCULPT_RADIUS_MAX,
  DISPLACEMENT_SCULPT_RADIUS_MIN,
} from '@/displacement/state/state_displacement_sculpt.js';

/**
 * Horizontal pointer travel in CSS pixels that doubles the brush radius while
 * resizing (the same travel to the left halves it).
 */
export const DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING = 100;

/**
 * Computes the brush radius after a horizontal resize drag. The radius scales
 * relative to where the drag started, so the same travel changes small and
 * large brushes by the same factor: every
 * {@link DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING} pixels to the right
 * double it, to the left halve it.
 *
 * @param startRadius Radius in meters when the drag started.
 * @param horizontalTravelPx Pointer travel to the right in CSS pixels; negative
 *   to the left.
 * @returns New radius in meters between DISPLACEMENT_SCULPT_RADIUS_MIN and
 *   DISPLACEMENT_SCULPT_RADIUS_MAX.
 */
export function displacementBrushResizeRadiusCompute(startRadius: number, horizontalTravelPx: number): number {
  const scaled = startRadius * Math.pow(2, horizontalTravelPx / DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING);
  if (!Number.isFinite(scaled)) {
    return DISPLACEMENT_SCULPT_RADIUS_MAX;
  }
  return Math.min(DISPLACEMENT_SCULPT_RADIUS_MAX, Math.max(DISPLACEMENT_SCULPT_RADIUS_MIN, scaled));
}
