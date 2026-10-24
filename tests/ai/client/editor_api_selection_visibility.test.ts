import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { MCP_SELECTION_VISIBILITY_ACTIONS } from '@/ai/shared/mcp_selection_visibility_actions.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Editor API over a world holding three separate boxes in one model. */
interface SelectionVisibilityApiRig {
  readonly parts: EditorApiTestHostParts;
  readonly api: EditorApi;
  readonly brushes: SolidBrushInstance[];
}

/**
 * Builds an editor API over three separated boxes.
 *
 * @returns Test rig.
 */
function selectionVisibilityApiRigCreate(): SelectionVisibilityApiRig {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('SelectionVisibilityApi');
  parts.world.add(model.root);
  const edges = new THREE.Vector3(1, 1, 1);
  const brushes = [0, 3, 6].map((x) => solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3(x, 0, 0)));
  return { parts, api: new EditorApi(parts.host), brushes };
}

/**
 * Selects the meshes of brushes.
 *
 * @param rig Test rig.
 * @param brushes Brushes to select.
 */
function brushesSelect(rig: SelectionVisibilityApiRig, brushes: readonly SolidBrushInstance[]): void {
  rig.parts.host.selectionManager.setSelection(brushes.flatMap((brush) => (brush.mesh ? [brush.mesh] : [])));
}

/**
 * Lists the evaluation visibility of brushes.
 *
 * @param brushes Brushes to read.
 * @returns Visibility flags.
 */
function brushVisibilityList(brushes: readonly SolidBrushInstance[]): boolean[] {
  return brushes.map((brush) => brush.visible);
}

/** Unit tests for the set_selection_visibility MCP tool. */
describe('EditorApi set_selection_visibility', () => {
  it('lists every action in the MCP catalog', () => {
    const description = findMcpTool('set_selection_visibility')?.description ?? '';
    for (const action of MCP_SELECTION_VISIBILITY_ACTIONS) {
      expect(description).toContain(action);
    }
  });

  it('hides the selected brushes and takes them out of evaluation', () => {
    const rig = selectionVisibilityApiRigCreate();
    const [hidden, ...kept] = rig.brushes;
    if (!hidden) {
      throw new Error('rig has no brushes');
    }
    brushesSelect(rig, [hidden]);
    const result = rig.api.invokeTool('set_selection_visibility', { action: 'hide' });
    expect(result.ok, result.message).toBe(true);
    expect((result.data as { changedCount: number }).changedCount).toBe(1);
    expect(hidden.visible).toBe(false);
    expect(brushVisibilityList(kept).every((visible) => visible)).toBe(true);
  });

  it('isolates the selection, shows everything again and undoes each step', () => {
    const rig = selectionVisibilityApiRigCreate();
    const [kept, ...others] = rig.brushes;
    if (!kept) {
      throw new Error('rig has no brushes');
    }
    brushesSelect(rig, [kept]);
    expect(rig.api.invokeTool('set_selection_visibility', { action: 'isolate' }).ok).toBe(true);
    expect(brushVisibilityList(others).some((visible) => visible)).toBe(false);
    const shown = rig.api.invokeTool('set_selection_visibility', { action: 'show_all' });
    expect((shown.data as { changedCount: number }).changedCount).toBe(others.length);
    expect(brushVisibilityList(rig.brushes).every((visible) => visible)).toBe(true);
    rig.parts.commandStack.undo();
    expect(brushVisibilityList(others).some((visible) => visible)).toBe(false);
  });

  it('rejects an unknown action', () => {
    const rig = selectionVisibilityApiRigCreate();
    expect(rig.api.invokeTool('set_selection_visibility', { action: 'toggle' }).ok).toBe(false);
  });
});
