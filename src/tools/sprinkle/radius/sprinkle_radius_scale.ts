import { brushResizeRadiusClamp, brushResizeRadiusScaleByDoublings } from '@/tools/brush_resize/brush_resize_radius.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_LIMITS } from '@/tools/sprinkle/sprinkle_types.js';

/**
 * Clamps a radius to the Sprinkle radius range.
 *
 * @param radius Requested radius in meters.
 * @returns Radius between SPRINKLE_RADIUS_MIN and SPRINKLE_RADIUS_MAX.
 */
export function sprinkleRadiusClamp(radius: number): number {
  return brushResizeRadiusClamp(radius, SPRINKLE_RADIUS_LIMITS);
}

/**
 * Scales the configured Sprinkle radius by a power of two, clamped to the
 * Sprinkle radius range, and stores it when it changed.
 *
 * @param doublings Number of doublings; one doubles the radius, minus one
 *   halves it.
 * @returns True when the stored radius changed.
 */
export function sprinkleRadiusScaleByDoublings(doublings: number): boolean {
  const state = getStateSprinkleTool();
  const radiusBefore = state.configRead().radius;
  const radiusAfter = brushResizeRadiusScaleByDoublings(radiusBefore, doublings, SPRINKLE_RADIUS_LIMITS);
  if (radiusAfter === radiusBefore) {
    return false;
  }
  state.configPatch({ radius: radiusAfter });
  return true;
}
