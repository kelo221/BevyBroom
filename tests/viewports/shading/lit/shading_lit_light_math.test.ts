import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SHADING_LIT_AMBIENT_LINEAR,
  SHADING_LIT_MIN_REACH,
  SHADING_LIT_POINT_CONE_COSINE,
  shadingLitAttenuation,
  shadingLitCone,
  shadingLitCosineFromDegrees,
  shadingLitFalloffPacked,
  shadingLitReach,
  shadingLitTubeCosine,
  shadingLitTubeNearestPoint,
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

/**
 * Tube lights follow the game renderer's area light math: distance is measured
 * to the nearest point of the tube, the reach shrinks by the half length, and
 * diffuse light is the mean cosine over the tube above the surface's horizon.
 */
describe('shading_lit_light_math tubes', () => {
  const center = new THREE.Vector3(2, 3, -1);
  const axis = new THREE.Vector3(1, 0, 0);
  const halfLength = 1.5;
  const up = new THREE.Vector3(0, 1, 0);

  it('shrinks the reach by the half length but never below the minimum', () => {
    expect(shadingLitReach(10, halfLength)).toBeCloseTo(10 - halfLength);
    expect(shadingLitReach(10, 0)).toBe(10);
    expect(shadingLitReach(1, 5)).toBe(SHADING_LIT_MIN_REACH);
  });

  it('measures to the nearest point on the tube segment', () => {
    const beside = center
      .clone()
      .addScaledVector(axis, 0.5)
      .add(new THREE.Vector3(0, -2, 0));
    const pastEnd = center.clone().addScaledVector(axis, halfLength + 4);
    expect(shadingLitTubeNearestPoint(center, axis, halfLength, beside).distanceTo(beside)).toBeCloseTo(2);
    expect(
      shadingLitTubeNearestPoint(center, axis, halfLength, pastEnd).distanceTo(
        center.clone().addScaledVector(axis, halfLength),
      ),
    ).toBeCloseTo(0);
  });

  it('acts like a point light when the tube is tiny and gives nothing below the horizon', () => {
    const below = center.clone().add(new THREE.Vector3(0, -2, 0));
    const tinyTube = shadingLitTubeCosine(center, axis, 1e-9, below, up);
    expect(tinyTube).toBeCloseTo(1);
    const facingAway = up.clone().negate();
    expect(shadingLitTubeCosine(center, axis, halfLength, below, facingAway)).toBe(0);
  });

  it('gives a surface under a long tube less than full light, more when the tube shortens', () => {
    const below = center.clone().add(new THREE.Vector3(0, -1, 0));
    const longTube = shadingLitTubeCosine(center, axis, 10, below, up);
    const shortTube = shadingLitTubeCosine(center, axis, 0.25, below, up);
    expect(longTube).toBeGreaterThan(0);
    expect(longTube).toBeLessThan(shortTube);
    expect(shortTube).toBeLessThanOrEqual(1);
  });

  it('counts only the part of a tube above a tilted surface horizon', () => {
    const surface = center.clone().add(new THREE.Vector3(0, -1, 0));
    const tiltedNormal = new THREE.Vector3(1, 0.2, 0).normalize();
    const tilted = shadingLitTubeCosine(center, axis, halfLength, surface, tiltedNormal);
    const mirrored = shadingLitTubeCosine(
      center,
      axis,
      halfLength,
      surface,
      tiltedNormal.clone().setX(-tiltedNormal.x),
    );
    expect(tilted).toBeGreaterThan(0);
    expect(tilted).toBeCloseTo(mirrored);
  });
});
