import { describe, expect, it, vi } from 'vitest';
import {
  FLOATING_PANEL_FIRST_PLACEMENT_RETRY_MAX,
  freeFirstPlacementRetryCancel,
  freeFirstPlacementRetryRemaining,
  freeFirstPlacementRetrySchedule,
  placementAnchorRectIsDegenerate,
} from '@/ui/floating_panel/panel_floating_first_placement.js';

/**
 * Builds a rect with the given size for degenerate-anchor checks.
 *
 * @param width Rect width.
 * @param height Rect height.
 * @returns DOMRect-like object.
 */
function rectWithSize(width: number, height: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('floating panel first placement helpers', () => {
  it('treats a zero-width or zero-height rect as degenerate', () => {
    expect(placementAnchorRectIsDegenerate(rectWithSize(0, 0))).toBe(true);
    expect(placementAnchorRectIsDegenerate(rectWithSize(0, 100))).toBe(true);
    expect(placementAnchorRectIsDegenerate(rectWithSize(100, 0))).toBe(true);
    expect(placementAnchorRectIsDegenerate(rectWithSize(100, 80))).toBe(false);
  });

  it('allows retries below the cap and cancels a scheduled frame', () => {
    expect(freeFirstPlacementRetryRemaining(0)).toBe(true);
    expect(freeFirstPlacementRetryRemaining(FLOATING_PANEL_FIRST_PLACEMENT_RETRY_MAX - 1)).toBe(true);
    expect(freeFirstPlacementRetryRemaining(FLOATING_PANEL_FIRST_PLACEMENT_RETRY_MAX)).toBe(false);
    const retry = vi.fn();
    const frameId = freeFirstPlacementRetrySchedule(retry);
    freeFirstPlacementRetryCancel(frameId);
    freeFirstPlacementRetryCancel(null);
    expect(retry).not.toHaveBeenCalled();
  });
});
