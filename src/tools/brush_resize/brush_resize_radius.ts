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
  return brushResizeRadiusScaleByDoublings(startRadius, horizontalTravelPx / BRUSH_RESIZE_PIXELS_PER_DOUBLING, limits);
}

/**
 * Scales a brush radius by a power of two: one doubling doubles it, minus one
 * halves it, fractions scale smoothly in between. The result is clamped.
 *
 * @param radius Radius in meters before scaling.
 * @param doublings Number of doublings; negative values shrink the radius.
 * @param limits Smallest and largest radius the result is clamped to.
 * @returns Scaled radius in meters between the limits.
 */
export function brushResizeRadiusScaleByDoublings(
  radius: number,
  doublings: number,
  limits: BrushResizeRadiusLimits,
): number {
  return brushResizeRadiusClamp(radius * Math.pow(2, doublings), limits);
}

/**
 * Clamps a brush radius to its limits. A radius that is not a number becomes
 * the smallest radius; infinite radii become the nearest limit.
 *
 * @param radius Requested radius in meters.
 * @param limits Smallest and largest radius allowed.
 * @returns Radius in meters between the limits.
 */
export function brushResizeRadiusClamp(radius: number, limits: BrushResizeRadiusLimits): number {
  if (Number.isNaN(radius)) {
    return limits.minimum;
  }
  return Math.min(limits.maximum, Math.max(limits.minimum, radius));
}
