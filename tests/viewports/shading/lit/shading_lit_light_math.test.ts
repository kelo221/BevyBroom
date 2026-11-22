import { describe, expect, it } from 'vitest';
import {
  SHADING_LIT_AMBIENT_LINEAR,
  SHADING_LIT_POINT_CONE_COSINE,
  shadingLitAttenuation,
  shadingLitCone,
  shadingLitCosineFromDegrees,
  shadingLitFalloffPacked,
} from '@/viewports/shading/lit/shading_lit_light_math.js';

/**
 * The Lit shading mode reproduces the game renderer's light formulas. These
 * tests check the formulas against their definitions rather than fixed samples:
 * full intensity at the light, zero at and past the radius, a monotonic decay,
 * a falloff that only darkens, and a linear cone edge.
 */
describe('shading_lit_light_math', () => {
  const intensity = 3;
  const radius = 6;
  const radiusSquared = radius * radius;

  it('gives the full intensity at the light and nothing at or past the radius', () => {
    expect(shadingLitAttenuation(intensity, radiusSquared, 0, 0)).toBeCloseTo(intensity);
    expect(shadingLitAttenuation(intensity, radiusSquared, 0, radiusSquared)).toBe(0);
    expect(shadingLitAttenuation(intensity, radiusSquared, 0, radiusSquared * 4)).toBe(0);
  });

  it('decays monotonically with distance', () => {
    const samples = Array.from({ length: 10 }, (_, step) => {
      const distance = (radius * step) / 10;
      return shadingLitAttenuation(intensity, radiusSquared, 0, distance * distance);
    });
    samples.slice(1).forEach((value, index) => expect(value).toBeLessThan(samples[index] ?? Infinity));
  });

  it('matches (1 − s)² · intensity at the halfway distance squared without falloff', () => {
    const halfwayRatio = 0.5;
    const expected = intensity * (1 - halfwayRatio) * (1 - halfwayRatio);
    expect(shadingLitAttenuation(intensity, radiusSquared, 0, radiusSquared * halfwayRatio)).toBeCloseTo(expected);
  });

  it('darkens with falloff inside the radius but keeps the value at the light', () => {
    const packed = shadingLitFalloffPacked(radius, 1);
    const midDistanceSquared = radiusSquared / 4;
    expect(packed).toBeCloseTo(radius);
    expect(shadingLitFalloffPacked(radius, 0)).toBe(0);
    expect(shadingLitAttenuation(intensity, radiusSquared, packed, 0)).toBeCloseTo(intensity);
    expect(shadingLitAttenuation(intensity, radiusSquared, packed, midDistanceSquared)).toBeLessThan(
      shadingLitAttenuation(intensity, radiusSquared, 0, midDistanceSquared),
    );
  });

  it('fades the cone linearly between the outer and inner cutoff cosines', () => {
    const innerCosine = shadingLitCosineFromDegrees(20);
    const outerCosine = shadingLitCosineFromDegrees(40);
    const middleCosine = (innerCosine + outerCosine) / 2;
    expect(shadingLitCone(1, innerCosine, outerCosine)).toBe(1);
    expect(shadingLitCone(outerCosine, innerCosine, outerCosine)).toBe(0);
    expect(shadingLitCone(shadingLitCosineFromDegrees(60), innerCosine, outerCosine)).toBe(0);
    expect(shadingLitCone(middleCosine, innerCosine, outerCosine)).toBeCloseTo(0.5);
  });

  it('gives equal cutoffs a hard edge and point lights a cone of one everywhere', () => {
    const cutoff = shadingLitCosineFromDegrees(30);
    expect(shadingLitCone(cutoff + 0.01, cutoff, cutoff)).toBe(1);
    expect(shadingLitCone(cutoff - 0.01, cutoff, cutoff)).toBe(0);
    [-1, 0, 1].forEach((theta) =>
      expect(shadingLitCone(theta, SHADING_LIT_POINT_CONE_COSINE, SHADING_LIT_POINT_CONE_COSINE)).toBe(1),
    );
  });

  it('uses the game renderer default ambient (alpha 32/255, squared)', () => {
    expect(SHADING_LIT_AMBIENT_LINEAR).toBeCloseTo((32 / 255) ** 2);
  });
});
