import { createViewportLeafPayload } from './area_editor_type.js';
import { createAreaLeafNode, createAreaSplitNode, type AreaTreeNode } from './area_tree_node.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';

/** Default area ids for top, front, side, and perspective viewport leaves. */
export const DEFAULT_AREA_IDS = {
  top: 'pane_top',
  front: 'pane_front',
  side: 'pane_side',
  perspective: 'pane_perspective',
} as const;

/**
 * Single full-workspace perspective area.
 *
 * @returns Layout tree root.
 */
export function createSinglePerspectiveLayout(): AreaTreeNode {
  return createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE));
}

/**
 * Builds a dual layout with top on the left and perspective on the right.
 *
 * @returns Layout tree root.
 */
export function createDualTopPerspectiveLayout(): AreaTreeNode {
  return createAreaSplitNode(
    'horizontal',
    0.5,
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.top, ViewportKind.TOP)),
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE)),
  );
}

/**
 * Builds a triple layout with top and front side by side on the top row and
 * perspective spanning the bottom row.
 *
 * @returns Layout tree root.
 */
export function createTripleLayout(): AreaTreeNode {
  const topFront = createAreaSplitNode(
    'horizontal',
    0.5,
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.top, ViewportKind.TOP)),
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.front, ViewportKind.FRONT)),
  );
  return createAreaSplitNode(
    'vertical',
    0.5,
    topFront,
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE)),
  );
}

/**
 * Map editor quad in two columns: perspective over side on the left, top over
 * front on the right.
 *
 * @returns Layout tree root.
 */
export function createQuadLayout(): AreaTreeNode {
  const leftColumn = createAreaSplitNode(
    'vertical',
    0.5,
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE)),
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.side, ViewportKind.SIDE)),
  );
  const rightColumn = createAreaSplitNode(
    'vertical',
    0.5,
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.top, ViewportKind.TOP)),
    createAreaLeafNode(createViewportLeafPayload(DEFAULT_AREA_IDS.front, ViewportKind.FRONT)),
  );
  return createAreaSplitNode('horizontal', 0.5, leftColumn, rightColumn);
}

/**
 * Builds the layout tree for a pane count of one through four.
 *
 * @param paneCount Number of panes from one through four.
 * @returns Layout tree root.
 */
export function createLayoutForPaneCount(paneCount: 1 | 2 | 3 | 4): AreaTreeNode {
  if (paneCount === 1) return createSinglePerspectiveLayout();
  if (paneCount === 2) return createDualTopPerspectiveLayout();
  if (paneCount === 3) return createTripleLayout();
  return createQuadLayout();
}
