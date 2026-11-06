import { describe, expect, it } from 'vitest';
import {
  DISPLACEMENT_SCULPT_RADIUS_MAX,
  DISPLACEMENT_SCULPT_RADIUS_MIN,
} from '@/displacement/state/state_displacement_sculpt.js';
import {
  DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING,
  displacementBrushResizeRadiusCompute,
} from '@/displacement/sculpt/displacement_brush_resize_radius.js';

/** Brush radius from a horizontal Shift + right drag. */
describe('displacementBrushResizeRadiusCompute', () => {
  const startRadius = (DISPLACEMENT_SCULPT_RADIUS_MIN + DISPLACEMENT_SCULPT_RADIUS_MAX) / 16;

  it('keeps the radius without travel', () => {
    expect(displacementBrushResizeRadiusCompute(startRadius, 0)).toBeCloseTo(startRadius, 12);
  });

  it('doubles per doubling distance to the right and halves per doubling distance to the left', () => {
    const step = DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING;
    expect(displacementBrushResizeRadiusCompute(startRadius, step)).toBeCloseTo(startRadius * 2, 12);
    expect(displacementBrushResizeRadiusCompute(startRadius, -step)).toBeCloseTo(startRadius / 2, 12);
    expect(displacementBrushResizeRadiusCompute(startRadius, step / 2)).toBeCloseTo(startRadius * Math.SQRT2, 12);
  });

  it('clamps to the radius range', () => {
    const farTravel = DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING * 1000;
    expect(displacementBrushResizeRadiusCompute(startRadius, farTravel)).toBe(DISPLACEMENT_SCULPT_RADIUS_MAX);
    expect(displacementBrushResizeRadiusCompute(startRadius, -farTravel)).toBe(DISPLACEMENT_SCULPT_RADIUS_MIN);
  });
});
