import type { SprinkleGridCell, SprinkleGridLayout } from './sprinkle_grid_layout.js';
import type { SprinkleGridPlane } from './sprinkle_grid_plane.js';

/** Circle in a grid plane whose cells are listed. */
export interface SprinkleGridCircle {
  /** U coordinate of the circle center. */
  readonly centerU: number;
  /** V coordinate of the circle center. */
  readonly centerV: number;
  /** Circle radius in meters. */
  readonly radius: number;
}

/** Index slack that keeps cells whose centers lie exactly on the circle. */
const SPRINKLE_GRID_CELL_INDEX_SLACK = 1e-9;

/** Lists the Sprinkle grid cells whose centers lie inside a circle. */
export class SprinkleGridCellEnumerator {
  /**
   * Returns about how many cell centers a circle holds.
   *
   * @param layout Grid layout.
   * @param circle Circle in the grid plane.
   * @returns Circle area divided by the cell area.
   */
  static cellCountEstimate(layout: SprinkleGridLayout, circle: SprinkleGridCircle): number {
    return (Math.PI * circle.radius * circle.radius) / (layout.sizeU * layout.sizeV);
  }

  /**
   * Returns every cell whose center lies inside or on the circle, ordered by
   * increasing U index and then V index.
   *
   * @param plane Grid plane.
   * @param layout Grid layout.
   * @param circle Circle in the grid plane.
   * @returns Cells inside the circle.
   */
  static cellsInCircle(
    plane: SprinkleGridPlane,
    layout: SprinkleGridLayout,
    circle: SprinkleGridCircle,
  ): SprinkleGridCell[] {
    const cells: SprinkleGridCell[] = [];
    const firstU = Math.ceil(
      (circle.centerU - circle.radius - layout.offsetU) / layout.sizeU - SPRINKLE_GRID_CELL_INDEX_SLACK,
    );
    const lastU = Math.floor(
      (circle.centerU + circle.radius - layout.offsetU) / layout.sizeU + SPRINKLE_GRID_CELL_INDEX_SLACK,
    );
    for (let indexU = firstU; indexU <= lastU; indexU++) {
      SprinkleGridCellEnumerator.columnCellsAppend(plane, layout, circle, indexU, cells);
    }
    return cells;
  }

  /**
   * Appends the cells of one U column whose centers lie inside the circle.
   *
   * @param plane Grid plane.
   * @param layout Grid layout.
   * @param circle Circle in the grid plane.
   * @param indexU Column index along U.
   * @param cells List receiving the cells.
   */
  private static columnCellsAppend(
    plane: SprinkleGridPlane,
    layout: SprinkleGridLayout,
    circle: SprinkleGridCircle,
    indexU: number,
    cells: SprinkleGridCell[],
  ): void {
    const offsetFromCenterU = layout.offsetU + indexU * layout.sizeU - circle.centerU;
    const halfChord = Math.sqrt(Math.max(0, circle.radius * circle.radius - offsetFromCenterU * offsetFromCenterU));
    const firstV = Math.ceil(
      (circle.centerV - halfChord - layout.offsetV) / layout.sizeV - SPRINKLE_GRID_CELL_INDEX_SLACK,
    );
    const lastV = Math.floor(
      (circle.centerV + halfChord - layout.offsetV) / layout.sizeV + SPRINKLE_GRID_CELL_INDEX_SLACK,
    );
    for (let indexV = firstV; indexV <= lastV; indexV++) {
      cells.push(layout.cellAt(plane, indexU, indexV));
    }
  }
}
