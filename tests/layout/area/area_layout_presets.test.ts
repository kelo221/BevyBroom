import { describe, expect, it } from 'vitest';
import { createQuadLayout, DEFAULT_AREA_IDS } from '@/layout/area/area_layout_presets.js';
import { listAreaLeafPlacements } from '@/layout/area/area_layout_tree.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { areaGridPaneAt, areaGridRectOf } from './area_layout_test_grid.js';

/**
 * Returns the viewport kind shown by one area of a layout.
 *
 * @param root Layout tree.
 * @param areaId Area to read.
 * @returns Viewport kind, or undefined for non-viewport areas.
 */
function viewportKindOf(root: ReturnType<typeof createQuadLayout>, areaId: string): ViewportKind | undefined {
  return listAreaLeafPlacements(root).find((item) => item.payload.areaId === areaId)?.payload.viewportKind;
}

describe('createQuadLayout', () => {
  it('places perspective over side on the left and top over front on the right', () => {
    const root = createQuadLayout();
    expect(viewportKindOf(root, areaGridPaneAt(root, 'left', 'upper'))).toBe(ViewportKind.PERSPECTIVE);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'left', 'lower'))).toBe(ViewportKind.SIDE);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'right', 'upper'))).toBe(ViewportKind.TOP);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'right', 'lower'))).toBe(ViewportKind.FRONT);
  });

  it('splits into two full-height columns so each column resizes on its own', () => {
    const root = createQuadLayout();
    expect(root.type).toBe('split');
    if (root.type !== 'split') return;
    expect(root.direction).toBe('horizontal');
    const perspective = areaGridRectOf(root, DEFAULT_AREA_IDS.perspective);
    const side = areaGridRectOf(root, DEFAULT_AREA_IDS.side);
    expect(perspective.x).toBeCloseTo(side.x, 6);
    expect(perspective.height + side.height).toBeCloseTo(1, 6);
  });
});
