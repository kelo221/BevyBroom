import { describe, expect, it } from 'vitest';
import {
  SprinkleGridCellEnumerator,
  type SprinkleGridCircle,
} from '@/tools/sprinkle/grid/sprinkle_grid_cell_enumerator.js';
import { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import { SprinkleGridPlane } from '@/tools/sprinkle/grid/sprinkle_grid_plane.js';

/**
 * Lists every cell of a layout with indices in a square around a circle, the
 * slow way, keeping the cells whose centers lie in the circle.
 *
 * @param plane Grid plane.
 * @param layout Grid layout.
 * @param circle Circle.
 * @returns Keys of the cells inside.
 */
function cellKeysBruteForce(
  plane: SprinkleGridPlane,
  layout: SprinkleGridLayout,
  circle: SprinkleGridCircle,
): string[] {
  const keys: string[] = [];
  const reach = Math.ceil(circle.radius / Math.min(layout.sizeU, layout.sizeV)) + 2;
  const center = layout.cellOf(plane, plane.pointCompose(circle.centerU, circle.centerV, 0));
  for (let indexU = center.indexU - reach; indexU <= center.indexU + reach; indexU++) {
    for (let indexV = center.indexV - reach; indexV <= center.indexV + reach; indexV++) {
      const cell = layout.cellAt(plane, indexU, indexV);
      if (Math.hypot(cell.centerU - circle.centerU, cell.centerV - circle.centerV) <= circle.radius) {
        keys.push(cell.key);
      }
    }
  }
  return keys.sort();
}

/** Cells whose centers lie inside the brush circle of a grid plane. */
describe('SprinkleGridCellEnumerator', () => {
  it('lists exactly the cells whose centers lie in the circle', () => {
    const plane = new SprinkleGridPlane('z');
    const layout = new SprinkleGridLayout(0.7, 1.3, 0.2, -0.4);
    const circle: SprinkleGridCircle = { centerU: 3.1, centerV: -1.7, radius: 4.37 };
    const keys = SprinkleGridCellEnumerator.cellsInCircle(plane, layout, circle).map((cell) => cell.key);
    expect(keys.length).toBeGreaterThan(0);
    expect([...keys].sort()).toEqual(cellKeysBruteForce(plane, layout, circle));
  });

  it('lists every cell once', () => {
    const plane = new SprinkleGridPlane('y');
    const layout = new SprinkleGridLayout(1, 1, 0, 0);
    const keys = SprinkleGridCellEnumerator.cellsInCircle(plane, layout, { centerU: 0, centerV: 0, radius: 6 });
    expect(new Set(keys.map((cell) => cell.key)).size).toBe(keys.length);
  });

  it('estimates about the number of cells it lists', () => {
    const plane = new SprinkleGridPlane('y');
    const layout = new SprinkleGridLayout(0.5, 0.5, 0, 0);
    const circle: SprinkleGridCircle = { centerU: 0.1, centerV: 0.2, radius: 10 };
    const listed = SprinkleGridCellEnumerator.cellsInCircle(plane, layout, circle).length;
    const estimate = SprinkleGridCellEnumerator.cellCountEstimate(layout, circle);
    expect(Math.abs(listed - estimate) / estimate).toBeLessThan(0.05);
  });
});
