import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionNumberFormat } from '@/level_export/collision/collision_number_format.js';

/**
 * Exported numbers have a fixed precision, so the same level gives the same
 * bytes.
 */
describe('CollisionNumberFormat', () => {
  it('rounds to six decimals without negative zero', () => {
    expect(CollisionNumberFormat.round(1.23456789)).toBe(1.234568);
    expect(Object.is(CollisionNumberFormat.round(-0.0000001), 0)).toBe(true);
    expect(CollisionNumberFormat.vector3(new THREE.Vector3(0.1 + 0.2, -0, 2))).toEqual([0.3, 0, 2]);
    expect(CollisionNumberFormat.quaternion(new THREE.Quaternion(0, Math.SQRT1_2, 0, Math.SQRT1_2))).toEqual([
      0, 0.707107, 0, 0.707107,
    ]);
  });
});
