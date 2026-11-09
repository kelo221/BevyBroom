import { describe, expect, it } from 'vitest';
import {
  BRUSH_RESIZE_PIXELS_PER_DOUBLING,
  brushResizeRadiusClamp,
  brushResizeRadiusCompute,
  brushResizeRadiusScaleByDoublings,
  type BrushResizeRadiusLimits,
} from '@/tools/brush_resize/brush_resize_radius.js';

/** Limits shared by the brush radius tests. */
const BRUSH_RESIZE_TEST_LIMITS: BrushResizeRadiusLimits = { minimum: 0.5, maximum: 64 };

/** A radius well inside the test limits. */
const BRUSH_RESIZE_TEST_START_RADIUS = (BRUSH_RESIZE_TEST_LIMITS.minimum + BRUSH_RESIZE_TEST_LIMITS.maximum) / 16;

/** Brush radius from a horizontal resize drag, shared by every paint brush. */
describe('brushResizeRadiusCompute', () => {
  const limits = BRUSH_RESIZE_TEST_LIMITS;
  const startRadius = BRUSH_RESIZE_TEST_START_RADIUS;

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

/**
 * Brush radius scaled by whole or fractional doublings, used by wheel and key
 * steps.
 */
describe('brushResizeRadiusScaleByDoublings', () => {
  const limits = BRUSH_RESIZE_TEST_LIMITS;
  const startRadius = BRUSH_RESIZE_TEST_START_RADIUS;

  it('doubles, halves and scales by fractions of a doubling', () => {
    expect(brushResizeRadiusScaleByDoublings(startRadius, 1, limits)).toBeCloseTo(startRadius * 2, 12);
    expect(brushResizeRadiusScaleByDoublings(startRadius, -1, limits)).toBeCloseTo(startRadius / 2, 12);
    expect(brushResizeRadiusScaleByDoublings(startRadius, 0.5, limits)).toBeCloseTo(startRadius * Math.SQRT2, 12);
  });

  it('matches a resize drag of the same number of doublings', () => {
    const doublings = 0.75;
    const travel = doublings * BRUSH_RESIZE_PIXELS_PER_DOUBLING;
    expect(brushResizeRadiusScaleByDoublings(startRadius, doublings, limits)).toBeCloseTo(
      brushResizeRadiusCompute(startRadius, travel, limits),
      12,
    );
  });

  it('clamps to the given limits, also for overflowing scales', () => {
    expect(brushResizeRadiusScaleByDoublings(limits.maximum, 1, limits)).toBe(limits.maximum);
    expect(brushResizeRadiusScaleByDoublings(limits.minimum, -1, limits)).toBe(limits.minimum);
    expect(brushResizeRadiusScaleByDoublings(startRadius, 1e6, limits)).toBe(limits.maximum);
  });
});

/** Brush radius clamping. */
describe('brushResizeRadiusClamp', () => {
  const limits = BRUSH_RESIZE_TEST_LIMITS;

  it('keeps radii inside the limits and moves others to the nearest limit', () => {
    expect(brushResizeRadiusClamp(BRUSH_RESIZE_TEST_START_RADIUS, limits)).toBe(BRUSH_RESIZE_TEST_START_RADIUS);
    expect(brushResizeRadiusClamp(limits.maximum * 2, limits)).toBe(limits.maximum);
    expect(brushResizeRadiusClamp(-limits.maximum, limits)).toBe(limits.minimum);
    expect(brushResizeRadiusClamp(Number.POSITIVE_INFINITY, limits)).toBe(limits.maximum);
  });

  it('turns a radius that is not a number into the smallest radius', () => {
    expect(brushResizeRadiusClamp(Number.NaN, limits)).toBe(limits.minimum);
  });
});
