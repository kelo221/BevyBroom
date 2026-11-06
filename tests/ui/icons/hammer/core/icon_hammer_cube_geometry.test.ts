import { describe, expect, it } from 'vitest';
import { IconHammerCubeGeometry, type IconHammerCubeLayout } from '@/ui/icons/hammer/core/icon_hammer_cube_geometry.js';

/** Cube layout every check builds its geometry from. */
const ICON_HAMMER_CUBE_TEST_LAYOUT: IconHammerCubeLayout = { left: 3, top: 2, size: 16, depth: 6 };

/**
 * Splits alternating coordinates into x and y lists.
 *
 * @param coordinates Alternating x and y values.
 * @returns The x values and the y values.
 */
function iconHammerCubeTestAxes(coordinates: readonly number[]): { xs: number[]; ys: number[] } {
  return {
    xs: coordinates.filter((_, index) => index % 2 === 0),
    ys: coordinates.filter((_, index) => index % 2 === 1),
  };
}

describe('IconHammerCubeGeometry', () => {
  it('places every visible corner on a half pixel inside the layout bounds', () => {
    const layout = ICON_HAMMER_CUBE_TEST_LAYOUT;
    const corners = new IconHammerCubeGeometry(layout).visibleCornerPoints();
    expect(corners).toHaveLength(14);
    corners.forEach((value) => expect(value - Math.floor(value)).toBe(0.5));
    const { xs, ys } = iconHammerCubeTestAxes(corners);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(layout.left);
    expect(Math.max(...xs)).toBeLessThanOrEqual(layout.left + layout.size + layout.depth + 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(layout.top);
    expect(Math.max(...ys)).toBeLessThanOrEqual(layout.top + layout.size + layout.depth + 1);
  });

  it('builds a square front face whose edge length is the layout size', () => {
    const { xs, ys } = iconHammerCubeTestAxes(new IconHammerCubeGeometry(ICON_HAMMER_CUBE_TEST_LAYOUT).frontPoints());
    expect(Math.max(...xs) - Math.min(...xs)).toBe(ICON_HAMMER_CUBE_TEST_LAYOUT.size);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(ICON_HAMMER_CUBE_TEST_LAYOUT.size);
  });

  it('recedes the top and side faces by the layout depth', () => {
    const geometry = new IconHammerCubeGeometry(ICON_HAMMER_CUBE_TEST_LAYOUT);
    const front = iconHammerCubeTestAxes(geometry.frontPoints());
    const top = iconHammerCubeTestAxes(geometry.topPoints());
    const side = iconHammerCubeTestAxes(geometry.sidePoints());
    expect(Math.min(...front.ys) - Math.min(...top.ys)).toBe(ICON_HAMMER_CUBE_TEST_LAYOUT.depth);
    expect(Math.max(...side.xs) - Math.max(...front.xs)).toBe(ICON_HAMMER_CUBE_TEST_LAYOUT.depth);
  });

  it('draws two lines per face boundary for every inner division', () => {
    const geometry = new IconHammerCubeGeometry(ICON_HAMMER_CUBE_TEST_LAYOUT);
    const moveCount = (pathData: string) => (pathData.match(/M/g) ?? []).length;
    expect(geometry.faceDividersPathData(1)).toBe('');
    expect(moveCount(geometry.faceDividersPathData(3))).toBe(2 * moveCount(geometry.faceDividersPathData(2)));
  });
});
