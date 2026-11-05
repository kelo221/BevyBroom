import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SprinkleSurfaceSampler } from '@/tools/sprinkle/sprinkle_surface_sampler.js';
import type { SprinkleConfig } from '@/tools/sprinkle/sprinkle_types.js';

describe('SprinkleSurfaceSampler', () => {
  it('generates deterministic seeded scatter samples aligned to sloped surface normals', () => {
    const slopeNormal = new THREE.Vector3(0.4, 0.9, 0.1).normalize();
    const centerHit = {
      point: new THREE.Vector3(10, 2, -5),
      normal: slopeNormal,
    };
    const config: SprinkleConfig = {
      radius: 3,
      density: 6,
      gridStepX: 0.5,
      gridStepZ: 0.5,
      mode: 'ADDITIVE',
      alignToNormal: true,
      randomYaw: true,
      scaleMin: 0.8,
      scaleMax: 1.2,
      seed: 4242,
    };
    const entries = [
      { entryId: 'prop_rock', weight: 3 },
      { entryId: 'prop_shrub', weight: 1 },
    ];
    const runA = SprinkleSurfaceSampler.sampleStamp(centerHit, config, entries);
    const runB = SprinkleSurfaceSampler.sampleStamp(centerHit, config, entries);
    expect(runA).toHaveLength(6);
    expect(runB).toHaveLength(6);
    for (let i = 0; i < runA.length; i++) {
      const sampleA = runA[i];
      const sampleB = runB[i];
      expect(sampleA?.entryId).toBe(sampleB?.entryId);
      expect(sampleA?.position.distanceTo(sampleB?.position ?? new THREE.Vector3())).toBeLessThan(1e-6);
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(sampleA?.quaternion ?? new THREE.Quaternion());
      expect(localUp.dot(slopeNormal)).toBeCloseTo(1, 5);
    }
  });
});
