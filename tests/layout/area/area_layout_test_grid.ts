import { listAreaLeafPlacements } from '@/layout/area/area_layout_tree.js';
import type { AreaTreeNode } from '@/layout/area/area_tree_node.js';

/** Column of a pane in a two by two grid. */
export type AreaGridColumn = 'left' | 'right';

/** Row of a pane in a two by two grid. */
export type AreaGridRow = 'upper' | 'lower';

/**
 * Finds the area id of the pane whose center lies in one cell of a two by two
 * grid, so tests can name panes by position instead of by preset layout.
 *
 * @param root Layout tree with four panes.
 * @param column Left or right half.
 * @param row Upper or lower half.
 * @returns Area id of the pane in that cell.
 */
export function areaGridPaneAt(root: AreaTreeNode, column: AreaGridColumn, row: AreaGridRow): string {
  const placement = listAreaLeafPlacements(root).find((item) => {
    const centerX = item.rect.x + item.rect.width / 2;
    const centerY = item.rect.y + item.rect.height / 2;
    return centerX < 0.5 === (column === 'left') && centerY < 0.5 === (row === 'upper');
  });
  if (!placement) {
    throw new Error(`no pane in the ${row} ${column} cell`);
  }
  return placement.payload.areaId;
}

/**
 * Returns the normalized rect of one area.
 *
 * @param root Layout tree.
 * @param areaId Area to find.
 * @returns Rect of the area.
 */
export function areaGridRectOf(
  root: AreaTreeNode,
  areaId: string,
): { x: number; y: number; width: number; height: number } {
  const placement = listAreaLeafPlacements(root).find((item) => item.payload.areaId === areaId);
  if (!placement) {
    throw new Error(`missing area ${areaId}`);
  }
  return placement.rect;
}
