import { describe, it, expect } from 'vitest';
import {
  CLIP_KEEP_MODE_CYCLE_ORDER,
  ClipKeepMode,
  clipKeepModeKeepsBack,
  clipKeepModeKeepsFront,
  clipKeepModeLabel,
  clipKeepModeNext,
} from '@/tools/clip_plane/clip_keep_mode.js';

/**
 * Proves the clip keep modes: their cycle order, labels and which side of the
 * plane each one keeps.
 */
describe('ClipKeepMode', () => {
  it('cycles every mode once and returns to the first one', () => {
    const firstMode = CLIP_KEEP_MODE_CYCLE_ORDER[0] ?? ClipKeepMode.SIDE_A;
    const visited = new Set<ClipKeepMode>();
    let mode = firstMode;
    for (let step = 0; step < CLIP_KEEP_MODE_CYCLE_ORDER.length; step++) {
      visited.add(mode);
      mode = clipKeepModeNext(mode);
    }
    expect(visited.size).toBe(CLIP_KEEP_MODE_CYCLE_ORDER.length);
    expect(mode).toBe(firstMode);
  });

  it('gives every mode its own label', () => {
    const labels = CLIP_KEEP_MODE_CYCLE_ORDER.map((mode) => clipKeepModeLabel(mode));
    expect(new Set(labels).size).toBe(labels.length);
    labels.forEach((label) => expect(label.length).toBeGreaterThan(0));
  });

  it('keeps exactly one side for Side A and Side B and both sides for Both', () => {
    expect([clipKeepModeKeepsFront(ClipKeepMode.SIDE_A), clipKeepModeKeepsBack(ClipKeepMode.SIDE_A)]).toEqual([
      true,
      false,
    ]);
    expect([clipKeepModeKeepsFront(ClipKeepMode.SIDE_B), clipKeepModeKeepsBack(ClipKeepMode.SIDE_B)]).toEqual([
      false,
      true,
    ]);
    expect([clipKeepModeKeepsFront(ClipKeepMode.BOTH), clipKeepModeKeepsBack(ClipKeepMode.BOTH)]).toEqual([true, true]);
  });
});
