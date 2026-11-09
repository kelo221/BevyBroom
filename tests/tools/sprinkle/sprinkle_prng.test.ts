import { describe, expect, it } from 'vitest';
import { SprinklePrng } from '@/tools/sprinkle/sprinkle_prng.js';
import { sprinkleTestCaseCreate } from './sprinkle_test_support.js';

/** Number of picks used to measure pick frequencies. */
const SPRINKLE_PRNG_TEST_PICKS = 20000;

/** Seeded random stream, chance rolls and weighted case picks. */
describe('SprinklePrng', () => {
  it('repeats the same stream for the same seed', () => {
    const first = new SprinklePrng(42);
    const second = new SprinklePrng(42);
    const firstValues = Array.from({ length: 8 }, () => first.nextFloat());
    expect(Array.from({ length: 8 }, () => second.nextFloat())).toEqual(firstValues);
  });

  it('never rolls a chance of 0 and always rolls a chance of 100', () => {
    const random = new SprinklePrng(7);
    const rolls = Array.from({ length: 500 }, () => [random.chancePercentRoll(0), random.chancePercentRoll(100)]);
    expect(rolls.every(([never, always]) => never === false && always === true)).toBe(true);
  });

  it('picks cases in proportion to their weights and never picks weightless cases', () => {
    const light = sprinkleTestCaseCreate('light', 1);
    const heavy = sprinkleTestCaseCreate('heavy', 3);
    const never = sprinkleTestCaseCreate('never', 0);
    const random = new SprinklePrng(99);
    const counts = new Map<string, number>();
    for (let pick = 0; pick < SPRINKLE_PRNG_TEST_PICKS; pick++) {
      const chosen = random.pickWeighted([light, never, heavy]);
      counts.set(chosen?.className ?? 'none', (counts.get(chosen?.className ?? 'none') ?? 0) + 1);
    }
    const heavyShare = (counts.get('heavy') ?? 0) / SPRINKLE_PRNG_TEST_PICKS;
    expect(heavyShare).toBeCloseTo(heavy.weight / (heavy.weight + light.weight), 1);
    expect(counts.has('never')).toBe(false);
  });

  it('picks nothing without a positive weight', () => {
    expect(new SprinklePrng(1).pickWeighted([sprinkleTestCaseCreate('zero', 0)])).toBeNull();
  });
});
