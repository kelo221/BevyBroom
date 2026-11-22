import { describe, expect, it } from 'vitest';
import { ProceduralLayoutRepeat } from '@/procedural/layout/procedural_layout_repeat.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

const PIECE_WIDTH = 4 * GRID_INTERVAL_MINIMUM;
const MAX_SPACING = 48 * GRID_INTERVAL_MINIMUM;
const RUN_LENGTHS = [1, 1.75, 2.5, 3.03125, 7.3125, 12, 20.28125];

/**
 * Returns the distances between neighbouring positions.
 *
 * @param positions Ascending positions.
 * @returns Gap between each position and the next.
 */
function gapsOf(positions: readonly number[]): number[] {
  return positions.slice(1).map((position, index) => position - (positions[index] ?? 0));
}

/** Pieces keep their size; only their spacing follows the run. */
describe('ProceduralLayoutRepeat', () => {
  it('puts the first piece flush to the start and the last flush to the end', () => {
    for (const run of RUN_LENGTHS) {
      const positions = ProceduralLayoutRepeat.positionsByMaxSpacing(run, PIECE_WIDTH, MAX_SPACING);
      expect(positions[0]).toBe(0);
      expect((positions[positions.length - 1] ?? 0) + PIECE_WIDTH).toBeCloseTo(run, 9);
    }
  });

  it('never spaces pieces further apart than the maximum and keeps them ascending', () => {
    for (const run of RUN_LENGTHS) {
      const gaps = gapsOf(ProceduralLayoutRepeat.positionsByMaxSpacing(run, PIECE_WIDTH, MAX_SPACING));
      for (const gap of gaps) {
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThanOrEqual(MAX_SPACING + 1e-9);
      }
    }
  });

  it('spreads the pieces evenly to within one grid step', () => {
    const gaps = gapsOf(ProceduralLayoutRepeat.positionsByMaxSpacing(9.5, PIECE_WIDTH, MAX_SPACING));
    expect(gaps.length).toBeGreaterThan(1);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(2 * GRID_INTERVAL_MINIMUM + 1e-9);
  });

  it('snaps every piece between the ends to the finest grid', () => {
    const positions = ProceduralLayoutRepeat.positionsByMaxSpacing(10, PIECE_WIDTH, MAX_SPACING);
    for (const position of positions) {
      const steps = position / GRID_INTERVAL_MINIMUM;
      expect(steps).toBeCloseTo(Math.round(steps), 9);
    }
  });

  it('uses more pieces for a longer run and never fewer', () => {
    let previousCount = 0;
    for (let run = 0.5; run <= 30; run += 0.25) {
      const count = ProceduralLayoutRepeat.positionsByMaxSpacing(run, PIECE_WIDTH, MAX_SPACING).length;
      expect(count).toBeGreaterThanOrEqual(previousCount);
      previousCount = count;
    }
    const shortCount = ProceduralLayoutRepeat.positionsByMaxSpacing(2, PIECE_WIDTH, MAX_SPACING).length;
    const longCount = ProceduralLayoutRepeat.positionsByMaxSpacing(20, PIECE_WIDTH, MAX_SPACING).length;
    expect(longCount).toBeGreaterThan(shortCount);
  });

  it('gives a run exactly one piece wide a single piece at the start', () => {
    expect(ProceduralLayoutRepeat.positionsByMaxSpacing(PIECE_WIDTH, PIECE_WIDTH, MAX_SPACING)).toEqual([0]);
  });

  it('gives a run shorter than one piece, or a zero run, no pieces', () => {
    expect(ProceduralLayoutRepeat.positionsByMaxSpacing(PIECE_WIDTH / 2, PIECE_WIDTH, MAX_SPACING)).toEqual([]);
    expect(ProceduralLayoutRepeat.positionsByMaxSpacing(0, PIECE_WIDTH, MAX_SPACING)).toEqual([]);
    expect(ProceduralLayoutRepeat.positionsByMaxSpacing(-1, PIECE_WIDTH, MAX_SPACING)).toEqual([]);
  });

  it('is deterministic', () => {
    const first = ProceduralLayoutRepeat.positionsByMaxSpacing(8.4375, PIECE_WIDTH, MAX_SPACING);
    const second = ProceduralLayoutRepeat.positionsByMaxSpacing(8.4375, PIECE_WIDTH, MAX_SPACING);
    expect(second).toEqual(first);
  });

  it('places an exact count flush at both ends and centers a single piece', () => {
    const positions = ProceduralLayoutRepeat.positionsByCount(5, PIECE_WIDTH, 5);
    expect(positions).toHaveLength(5);
    expect(positions[0]).toBe(0);
    expect(positions[4]).toBeCloseTo(5 - PIECE_WIDTH, 9);
    expect(ProceduralLayoutRepeat.positionsByCount(5, PIECE_WIDTH, 1)).toEqual([(5 - PIECE_WIDTH) / 2]);
  });

  it('places no pieces for a count below one', () => {
    expect(ProceduralLayoutRepeat.positionsByCount(5, PIECE_WIDTH, 0)).toEqual([]);
  });

  it('snaps a value to the nearest finest grid step', () => {
    expect(ProceduralLayoutRepeat.gridSnap(GRID_INTERVAL_MINIMUM * 3.4)).toBe(GRID_INTERVAL_MINIMUM * 3);
    expect(ProceduralLayoutRepeat.gridSnap(GRID_INTERVAL_MINIMUM * 3.6)).toBe(GRID_INTERVAL_MINIMUM * 4);
  });
});
