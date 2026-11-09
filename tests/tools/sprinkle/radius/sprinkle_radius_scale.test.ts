import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleRadiusClamp, sprinkleRadiusScaleByDoublings } from '@/tools/sprinkle/radius/sprinkle_radius_scale.js';

/** Scaling and clamping the configured Sprinkle radius. */
describe('sprinkleRadiusScale', () => {
  afterEach(() => {
    getStateSprinkleTool().reset();
  });

  it('clamps radii to the Sprinkle range', () => {
    const insideRadius = (SPRINKLE_RADIUS_MIN + SPRINKLE_RADIUS_MAX) / 2;
    expect(sprinkleRadiusClamp(insideRadius)).toBe(insideRadius);
    expect(sprinkleRadiusClamp(SPRINKLE_RADIUS_MAX * 2)).toBe(SPRINKLE_RADIUS_MAX);
    expect(sprinkleRadiusClamp(-SPRINKLE_RADIUS_MAX)).toBe(SPRINKLE_RADIUS_MIN);
    expect(sprinkleRadiusClamp(Number.NaN)).toBe(SPRINKLE_RADIUS_MIN);
  });

  it('stores the scaled radius and notifies listeners', () => {
    const radiusBefore = getStateSprinkleTool().configRead().radius;
    const listener = vi.fn();
    const unsubscribe = getStateSprinkleTool().changeListenerAdd(listener);
    expect(sprinkleRadiusScaleByDoublings(1)).toBe(true);
    unsubscribe();
    expect(getStateSprinkleTool().configRead().radius).toBeCloseTo(radiusBefore * 2, 9);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('reports no change and stores nothing at a limit', () => {
    getStateSprinkleTool().configPatch({ radius: SPRINKLE_RADIUS_MAX });
    const listener = vi.fn();
    const unsubscribe = getStateSprinkleTool().changeListenerAdd(listener);
    expect(sprinkleRadiusScaleByDoublings(1)).toBe(false);
    unsubscribe();
    expect(getStateSprinkleTool().configRead().radius).toBe(SPRINKLE_RADIUS_MAX);
    expect(listener).not.toHaveBeenCalled();
  });
});
