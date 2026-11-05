import type {
  SerializedAreaLayout,
  SerializedAreaLeaf,
  SerializedAreaNode,
  SerializedAreaSplit,
} from '@/layout/area/area_layout_serializer.js';
import { DEFAULT_AREA_IDS } from '@/layout/area/area_layout_presets.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';

/**
 * Left and right columns of a two-column quad whose bottom row holds two
 * leaves.
 */
interface WorkspaceQuadBottomRowLeaves {
  root: SerializedAreaSplit;
  leftColumn: SerializedAreaSplit;
  rightColumn: SerializedAreaSplit;
  bottomLeft: SerializedAreaLeaf;
  bottomRight: SerializedAreaLeaf;
}

/**
 * Returns a quad layout with side and front swapped on the bottom row when the
 * layout still has side on the bottom left and front on the bottom right. Split
 * ratios and cameras stay as saved; any other layout is returned as is.
 *
 * @param layout Saved quad layout.
 * @returns Layout with front bottom left and side bottom right, or the input.
 */
export function workspaceQuadBottomRowMigrate(layout: SerializedAreaLayout): SerializedAreaLayout {
  const leaves = workspaceQuadBottomRowLeavesRead(layout.root);
  if (!leaves || !workspaceQuadBottomRowIsSideThenFront(leaves)) {
    return layout;
  }
  const leftColumn: SerializedAreaSplit = { ...leaves.leftColumn, second: leaves.bottomRight };
  const rightColumn: SerializedAreaSplit = { ...leaves.rightColumn, second: leaves.bottomLeft };
  return { ...layout, root: { ...leaves.root, first: leftColumn, second: rightColumn } };
}

/**
 * Reads the bottom row leaves of a horizontal split of two vertical columns.
 *
 * @param root Saved layout root.
 * @returns Columns and bottom leaves, or null when the shape differs.
 */
function workspaceQuadBottomRowLeavesRead(root: SerializedAreaNode): WorkspaceQuadBottomRowLeaves | null {
  if (root.type !== 'split' || root.direction !== 'horizontal') {
    return null;
  }
  const leftColumn = workspaceQuadColumnRead(root.first);
  const rightColumn = workspaceQuadColumnRead(root.second);
  if (!leftColumn || !rightColumn) {
    return null;
  }
  const bottomLeft = leftColumn.second;
  const bottomRight = rightColumn.second;
  if (bottomLeft.type !== 'leaf' || bottomRight.type !== 'leaf') {
    return null;
  }
  return { root, leftColumn, rightColumn, bottomLeft, bottomRight };
}

/**
 * Returns a node as a vertical column split.
 *
 * @param node Saved layout node.
 * @returns The vertical split, or null for any other node.
 */
function workspaceQuadColumnRead(node: SerializedAreaNode): SerializedAreaSplit | null {
  return node.type === 'split' && node.direction === 'vertical' ? node : null;
}

/**
 * Returns whether the bottom row shows side on the left and front on the right.
 *
 * @param leaves Bottom row leaves of the quad.
 * @returns True for the side-then-front bottom row.
 */
function workspaceQuadBottomRowIsSideThenFront(leaves: WorkspaceQuadBottomRowLeaves): boolean {
  return (
    workspaceQuadLeafMatches(leaves.bottomLeft, DEFAULT_AREA_IDS.side, ViewportKind.SIDE) &&
    workspaceQuadLeafMatches(leaves.bottomRight, DEFAULT_AREA_IDS.front, ViewportKind.FRONT)
  );
}

/**
 * Returns whether a saved leaf is the given default pane showing the given
 * kind.
 *
 * @param leaf Saved leaf.
 * @param areaId Expected area id.
 * @param kind Expected viewport kind.
 * @returns True when both match.
 */
function workspaceQuadLeafMatches(leaf: SerializedAreaLeaf, areaId: string, kind: ViewportKind): boolean {
  return leaf.areaId === areaId && leaf.viewportKind === kind;
}
