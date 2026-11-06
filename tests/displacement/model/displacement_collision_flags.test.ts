import { describe, expect, it } from 'vitest';
import { DISPLACEMENT_COLLISION_FLAG_KEYS } from '@/displacement/model/displacement_types.js';
import {
  displacementCollisionFlagsAnySet,
  displacementCollisionFlagsDefault,
  displacementCollisionFlagsMerge,
  displacementCollisionFlagsRead,
} from '@/displacement/model/displacement_collision_flags.js';

/** Collision flags of displacement surfaces. */
describe('displacement collision flags', () => {
  it('defaults every flag to off and reports when any flag is on', () => {
    const flags = displacementCollisionFlagsDefault();
    expect(displacementCollisionFlagsAnySet(flags)).toBe(false);
    DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => {
      expect(flags[key]).toBe(false);
      expect(displacementCollisionFlagsAnySet({ ...flags, [key]: true })).toBe(true);
    });
  });

  it('merges only the named boolean flags', () => {
    const base = { ...displacementCollisionFlagsDefault(), seals: true };
    const merged = displacementCollisionFlagsMerge(base, { noRayCollision: true, seals: false });
    expect(merged).toEqual({ noPhysicsCollision: false, noHullCollision: false, noRayCollision: true, seals: false });
    expect(base.seals).toBe(true);
    expect(displacementCollisionFlagsMerge(base, {})).toEqual(base);
  });

  it('reads JSON flags, filling missing keys with off and rejecting non-boolean values', () => {
    expect(displacementCollisionFlagsRead(undefined)).toEqual(displacementCollisionFlagsDefault());
    expect(displacementCollisionFlagsRead({ noPhysicsCollision: true, unknown: 3 })).toEqual({
      ...displacementCollisionFlagsDefault(),
      noPhysicsCollision: true,
    });
    expect(displacementCollisionFlagsRead({ noHullCollision: 1 })).toBeNull();
    expect(displacementCollisionFlagsRead([true])).toBeNull();
    expect(displacementCollisionFlagsRead(null)).toBeNull();
  });
});
