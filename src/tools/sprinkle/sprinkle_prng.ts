/** Anything a weighted pick may choose, carrying its relative chance. */
export interface SprinkleWeighted {
  /** Relative chance of being chosen; entries at or below zero never are. */
  readonly weight: number;
}

/**
 * Deterministic Mulberry32 pseudo-random number generator, so seeded strokes
 * and sculpt noise are reproducible.
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
   * Returns whether a roll succeeds for a chance in percent.
   *
   * @param chancePercent Chance from 0 (never) to 100 (always).
   * @returns True when the roll lands inside the chance.
   */
  chancePercentRoll(chancePercent: number): boolean {
    return this.nextFloat() * 100 < chancePercent;
  }

  /**
   * Picks one entry with a chance proportional to its weight.
   *
   * @param entries Weighted entries.
   * @returns Chosen entry, or null when no entry has a positive weight.
   */
  pickWeighted<TEntry extends SprinkleWeighted>(entries: readonly TEntry[]): TEntry | null {
    const positiveEntries = entries.filter((entry) => entry.weight > 0);
    const total = positiveEntries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
      return null;
    }
    let threshold = this.nextFloat() * total;
    for (const entry of positiveEntries) {
      threshold -= entry.weight;
      if (threshold < 0) {
        return entry;
      }
    }
    return positiveEntries[positiveEntries.length - 1] ?? null;
  }
}
