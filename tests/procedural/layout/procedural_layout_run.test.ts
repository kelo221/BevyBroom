import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PROCEDURAL_LAYOUT_RUN_MIN_LENGTH, ProceduralLayoutRun } from '@/procedural/layout/procedural_layout_run.js';

/** The run turns two points into a horizontal length and a slope. */
describe('ProceduralLayoutRun', () => {
  it('measures the horizontal length and the rise between the points', () => {
    const run = new ProceduralLayoutRun(new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 8, 7));
    expect(run.run).toBeCloseTo(Math.hypot(3, 4), 9);
    expect(run.rise).toBe(6);
    expect(run.slope()).toBeCloseTo(6 / Math.hypot(3, 4), 9);
  });

  it('is usable from the shortest run and not below it', () => {
    const origin = new THREE.Vector3();
    expect(new ProceduralLayoutRun(origin, new THREE.Vector3(PROCEDURAL_LAYOUT_RUN_MIN_LENGTH, 0, 0)).isUsable()).toBe(
      true,
    );
    expect(
      new ProceduralLayoutRun(origin, new THREE.Vector3(PROCEDURAL_LAYOUT_RUN_MIN_LENGTH / 2, 5, 0)).isUsable(),
    ).toBe(false);
  });

  it('has no slope when the points are on one plumb line', () => {
    expect(new ProceduralLayoutRun(new THREE.Vector3(), new THREE.Vector3(0, 4, 0)).slope()).toBe(0);
  });
});
