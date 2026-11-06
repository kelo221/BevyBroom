import type { SprinkleWeightedEntry } from './sprinkle_types.js';

/**
 * Deterministic Mulberry32 pseudo-random number generator used by the Sprinkle
 * scatter tool so scatter strokes are reproducible under unit tests.
 */
export class SprinklePrng {
  private state: number;

  /**
   * Creates a seeded PRNG.
   *
   * @param seed Initial integer seed.
   */
  constructor(seed: number) {
    this.state = seed | 0;
  }

  /**
   * Returns the next pseudo-random float in `[0, 1)`.
   *
   * @returns Pseudo-random float in `[0, 1)`.
   */
  nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random float in `[min, max)`.
   *
   * @param min Lower bound (inclusive).
   * @param max Upper bound (exclusive).
   * @returns Value in `[min, max)`.
   */
  range(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Selects an `entryId` from a weighted list using the PRNG stream.
   *
   * @param entries Weighted entries.
   * @returns Chosen entryId, or null when no positive-weight entry exists.
   */
  pickWeighted(entries: readonly SprinkleWeightedEntry[]): string | null {
    let total = 0;
    for (const entry of entries) {
      if (entry.weight > 0) {
        total += entry.weight;
      }
    }
    if (total <= 0) {
      return null;
    }
    let threshold = this.nextFloat() * total;
    for (const entry of entries) {
      if (entry.weight <= 0) continue;
      threshold -= entry.weight;
      if (threshold <= 0) {
        return entry.entryId;
      }
    }
    return entries[entries.length - 1]?.entryId ?? null;
  }
}
