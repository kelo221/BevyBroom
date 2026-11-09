import { describe, expect, it } from 'vitest';
import {
  BRUSH_RESIZE_PIXELS_PER_DOUBLING,
  brushResizeRadiusCompute,
  type BrushResizeRadiusLimits,
} from '@/tools/brush_resize/brush_resize_radius.js';

/** Brush radius from a horizontal resize drag, shared by every paint brush. */
describe('brushResizeRadiusCompute', () => {
  const limits: BrushResizeRadiusLimits = { minimum: 0.5, maximum: 64 };
  const startRadius = (limits.minimum + limits.maximum) / 16;

  it('keeps the radius without travel', () => {
    expect(brushResizeRadiusCompute(startRadius, 0, limits)).toBeCloseTo(startRadius, 12);
  });

  it('doubles per doubling distance to the right and halves per doubling distance to the left', () => {
    const step = BRUSH_RESIZE_PIXELS_PER_DOUBLING;
    expect(brushResizeRadiusCompute(startRadius, step, limits)).toBeCloseTo(startRadius * 2, 12);
    expect(brushResizeRadiusCompute(startRadius, -step, limits)).toBeCloseTo(startRadius / 2, 12);
    expect(brushResizeRadiusCompute(startRadius, step / 2, limits)).toBeCloseTo(startRadius * Math.SQRT2, 12);
  });

  it('clamps to the given limits', () => {
    const farTravel = BRUSH_RESIZE_PIXELS_PER_DOUBLING * 1000;
    expect(brushResizeRadiusCompute(startRadius, farTravel, limits)).toBe(limits.maximum);
    expect(brushResizeRadiusCompute(startRadius, -farTravel, limits)).toBe(limits.minimum);
  });
});
