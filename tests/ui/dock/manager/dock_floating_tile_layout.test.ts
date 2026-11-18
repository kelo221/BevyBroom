import { describe, expect, it } from 'vitest';
import { dockFloatingTileRectsCompute } from '@/ui/dock/manager/dock_floating_tile_layout.js';

/** Area the tiling tests fill. */
const AREA = { left: 20, top: 30, width: 1200, height: 800 };

/**
 * Returns whether two rects overlap.
 *
 * @param first First rect.
 * @param second Second rect.
 * @returns True when they share area.
 */
function rectsOverlap(
  first: { left: number; top: number; width: number; height: number },
  second: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    first.left < second.left + second.width &&
    second.left < first.left + first.width &&
    first.top < second.top + second.height &&
    second.top < first.top + first.height
  );
}

/**
 * Tiling splits the area into equal cells that stay inside it and never
 * overlap.
 */
describe('dockFloatingTileRectsCompute', () => {
  it('returns one non-overlapping cell inside the area per window', () => {
    for (const windowCount of [1, 2, 3, 5, 7]) {
      const rects = dockFloatingTileRectsCompute(AREA, windowCount);
      expect(rects).toHaveLength(windowCount);
      rects.forEach((rect, index) => {
        expect(rect.left).toBeGreaterThanOrEqual(AREA.left);
        expect(rect.top).toBeGreaterThanOrEqual(AREA.top);
        expect(rect.left + rect.width).toBeLessThanOrEqual(AREA.left + AREA.width);
        expect(rect.top + rect.height).toBeLessThanOrEqual(AREA.top + AREA.height);
        rects.slice(index + 1).forEach((other) => expect(rectsOverlap(rect, other)).toBe(false));
      });
    }
  });

  it('returns nothing for no windows', () => {
    expect(dockFloatingTileRectsCompute(AREA, 0)).toEqual([]);
  });
});
