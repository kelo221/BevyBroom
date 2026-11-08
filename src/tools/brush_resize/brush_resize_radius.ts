/**
 * Horizontal pointer travel in CSS pixels that doubles a brush radius while
 * resizing (the same travel to the left halves it).
 */
export const BRUSH_RESIZE_PIXELS_PER_DOUBLING = 100;

/** Smallest and largest radius a resized brush may take, in meters. */
export interface BrushResizeRadiusLimits {
  /** Smallest radius. */
  readonly minimum: number;
  /** Largest radius. */
  readonly maximum: number;
}

/**
 * Computes a brush radius after a horizontal resize drag. The radius scales
 * relative to where the drag started, so the same travel changes small and
 * large brushes by the same factor: every
 * {@link BRUSH_RESIZE_PIXELS_PER_DOUBLING} pixels to the right double it, to the
 * left halve it.
 *
 * @param startRadius Radius in meters when the drag started.
 * @param horizontalTravelPx Pointer travel to the right in CSS pixels; negative
 *   to the left.
 * @param limits Smallest and largest radius the result is clamped to.
 * @returns New radius in meters between the limits.
 */
export function brushResizeRadiusCompute(
  startRadius: number,
  horizontalTravelPx: number,
  limits: BrushResizeRadiusLimits,
): number {
  const scaled = startRadius * Math.pow(2, horizontalTravelPx / BRUSH_RESIZE_PIXELS_PER_DOUBLING);
  if (!Number.isFinite(scaled)) {
    return limits.maximum;
  }
  return Math.min(limits.maximum, Math.max(limits.minimum, scaled));
}
