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
  it('places perspective and top on the upper row and front and side on the lower row', () => {
    const root = createQuadLayout();
    expect(viewportKindOf(root, areaGridPaneAt(root, 'left', 'upper'))).toBe(ViewportKind.PERSPECTIVE);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'right', 'upper'))).toBe(ViewportKind.TOP);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'left', 'lower'))).toBe(ViewportKind.FRONT);
    expect(viewportKindOf(root, areaGridPaneAt(root, 'right', 'lower'))).toBe(ViewportKind.SIDE);
  });

  it('keeps each default pane id on the viewport kind it names', () => {
    const root = createQuadLayout();
    expect(viewportKindOf(root, DEFAULT_AREA_IDS.perspective)).toBe(ViewportKind.PERSPECTIVE);
    expect(viewportKindOf(root, DEFAULT_AREA_IDS.top)).toBe(ViewportKind.TOP);
    expect(viewportKindOf(root, DEFAULT_AREA_IDS.front)).toBe(ViewportKind.FRONT);
    expect(viewportKindOf(root, DEFAULT_AREA_IDS.side)).toBe(ViewportKind.SIDE);
  });

  it('splits into two full-height columns so each column resizes on its own', () => {
    const root = createQuadLayout();
    expect(root.type).toBe('split');
    if (root.type !== 'split') return;
    expect(root.direction).toBe('horizontal');
    const perspective = areaGridRectOf(root, DEFAULT_AREA_IDS.perspective);
    const front = areaGridRectOf(root, DEFAULT_AREA_IDS.front);
    expect(perspective.x).toBeCloseTo(front.x, 6);
    expect(perspective.height + front.height).toBeCloseTo(1, 6);
  });
});
