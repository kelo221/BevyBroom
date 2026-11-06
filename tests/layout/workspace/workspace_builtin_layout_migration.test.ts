import { describe, expect, it } from 'vitest';
import { createViewportLeafPayload } from '@/layout/area/area_editor_type.js';
import { createQuadLayout, createTripleLayout, DEFAULT_AREA_IDS } from '@/layout/area/area_layout_presets.js';
import {
  deserializeAreaLayout,
  serializeAreaLayout,
  type SerializedAreaLayout,
} from '@/layout/area/area_layout_serializer.js';
import { listAreaLeafPlacements } from '@/layout/area/area_layout_tree.js';
import { createAreaLeafNode, createAreaSplitNode, type AreaTreeNode } from '@/layout/area/area_tree_node.js';
import {
  WORKSPACE_BUILTIN_LAYOUT_REVISION,
  workspaceBuiltinLayoutsMigrate,
} from '@/layout/workspace/workspace_builtin_layout_migration.js';
import { workspaceQuadBottomRowMigrate } from '@/layout/workspace/workspace_builtin_quad_bottom_row_migration.js';
import { createDefaultWorkspaces, WORKSPACE_IDS } from '@/layout/workspace/workspace_definition.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { areaGridPaneAt } from '../area/area_layout_test_grid.js';

/**
 * Builds the earlier two-column quad with side on the lower left and front on
 * the lower right, using the given column split ratios.
 *
 * @param columnRatio Ratio of the left column.
 * @param leftRowRatio Ratio of the upper pane in the left column.
 * @returns Serialized layout in the earlier order.
 */
function createSideThenFrontQuadLayout(columnRatio: number, leftRowRatio: number): SerializedAreaLayout {
  const leaf = (areaId: string, kind: ViewportKind): AreaTreeNode =>
    createAreaLeafNode(createViewportLeafPayload(areaId, kind));
  const left = createAreaSplitNode(
    'vertical',
    leftRowRatio,
    leaf(DEFAULT_AREA_IDS.perspective, ViewportKind.PERSPECTIVE),
    leaf(DEFAULT_AREA_IDS.side, ViewportKind.SIDE),
  );
  const right = createAreaSplitNode(
    'vertical',
    0.5,
    leaf(DEFAULT_AREA_IDS.top, ViewportKind.TOP),
    leaf(DEFAULT_AREA_IDS.front, ViewportKind.FRONT),
  );
  return serializeAreaLayout(createAreaSplitNode('horizontal', columnRatio, left, right));
}

/**
 * Deserializes a layout and fails the test when it is invalid.
 *
 * @param layout Serialized layout.
 * @returns Layout tree root.
 */
function layoutTreeOf(layout: SerializedAreaLayout): AreaTreeNode {
  const root = deserializeAreaLayout(layout);
  if (!root) {
    throw new Error('layout did not deserialize');
  }
  return root;
}

/**
 * Returns the viewport kind shown in one grid cell of a layout.
 *
 * @param root Layout tree.
 * @param column Grid column.
 * @param row Grid row.
 * @returns Viewport kind in that cell.
 */
function kindAt(root: AreaTreeNode, column: 'left' | 'right', row: 'upper' | 'lower'): ViewportKind | undefined {
  const areaId = areaGridPaneAt(root, column, row);
  return listAreaLeafPlacements(root).find((item) => item.payload.areaId === areaId)?.payload.viewportKind;
}

describe('workspaceQuadBottomRowMigrate', () => {
  it('swaps side and front on the bottom row of the earlier quad', () => {
    const root = layoutTreeOf(workspaceQuadBottomRowMigrate(createSideThenFrontQuadLayout(0.5, 0.5)));
    expect(kindAt(root, 'left', 'upper')).toBe(ViewportKind.PERSPECTIVE);
    expect(kindAt(root, 'right', 'upper')).toBe(ViewportKind.TOP);
    expect(kindAt(root, 'left', 'lower')).toBe(ViewportKind.FRONT);
    expect(kindAt(root, 'right', 'lower')).toBe(ViewportKind.SIDE);
  });

  it('keeps the split ratios the user dragged', () => {
    const columnRatio = 0.37;
    const leftRowRatio = 0.62;
    const migrated = workspaceQuadBottomRowMigrate(createSideThenFrontQuadLayout(columnRatio, leftRowRatio));
    const root = migrated.root;
    expect(root.type === 'split' ? root.ratio : NaN).toBeCloseTo(columnRatio, 6);
    const left = root.type === 'split' ? root.first : root;
    expect(left.type === 'split' ? left.ratio : NaN).toBeCloseTo(leftRowRatio, 6);
  });

  it('matches the current built-in quad after migrating the earlier default', () => {
    const migrated = workspaceQuadBottomRowMigrate(createSideThenFrontQuadLayout(0.5, 0.5));
    expect(migrated).toEqual(serializeAreaLayout(createQuadLayout()));
  });

  it('leaves the current quad and other layouts untouched', () => {
    const current = serializeAreaLayout(createQuadLayout());
    const triple = serializeAreaLayout(createTripleLayout());
    expect(workspaceQuadBottomRowMigrate(current)).toBe(current);
    expect(workspaceQuadBottomRowMigrate(triple)).toBe(triple);
  });
});

describe('workspaceBuiltinLayoutsMigrate', () => {
  it('reorders the quad saved with the two-column revision and keeps other workspaces', () => {
    const defaults = createDefaultWorkspaces();
    const oldQuad = createSideThenFrontQuadLayout(0.5, 0.5);
    const saved = defaults.map((item) => (item.id === WORKSPACE_IDS.quad ? { ...item, layout: oldQuad } : item));
    const migrated = workspaceBuiltinLayoutsMigrate(saved, WORKSPACE_BUILTIN_LAYOUT_REVISION - 1);
    const quad = migrated.find((item) => item.id === WORKSPACE_IDS.quad);
    expect(quad?.layout).toEqual(serializeAreaLayout(createQuadLayout()));
    const triple = migrated.find((item) => item.id === WORKSPACE_IDS.triple);
    expect(triple).toBe(saved.find((item) => item.id === WORKSPACE_IDS.triple));
  });

  it('keeps a custom quad layout saved with the two-column revision', () => {
    const custom = serializeAreaLayout(createTripleLayout());
    const saved = createDefaultWorkspaces().map((item) =>
      item.id === WORKSPACE_IDS.quad ? { ...item, layout: custom } : item,
    );
    const migrated = workspaceBuiltinLayoutsMigrate(saved, WORKSPACE_BUILTIN_LAYOUT_REVISION - 1);
    expect(migrated.find((item) => item.id === WORKSPACE_IDS.quad)?.layout).toEqual(custom);
  });

  it('returns saved workspaces unchanged at the current revision', () => {
    const saved = createDefaultWorkspaces();
    expect(workspaceBuiltinLayoutsMigrate(saved, WORKSPACE_BUILTIN_LAYOUT_REVISION)).toBe(saved);
  });
});
