import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { solidBrushesWorldVertexBounds } from '@/solid/model/solid_brush_world_bounds.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Editor API over a world holding two boxes in one model. */
interface BrushToolsApiRig {
  readonly parts: EditorApiTestHostParts;
  readonly api: EditorApi;
  readonly model: SolidModel;
  readonly brushes: SolidBrushInstance[];
}

/**
 * Builds an editor API over two separated boxes.
 *
 * @returns Test rig.
 */
function brushToolsApiRigCreate(): BrushToolsApiRig {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('BrushToolsApi');
  parts.world.add(model.root);
  const brushes = [
    solidBrushToolsTestBoxAdd(model, new THREE.Vector3(4, 4, 4), new THREE.Vector3(0, 0, 0)),
    solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 2, 2), new THREE.Vector3(5, 1, 0)),
  ];
  return { parts, api: new EditorApi(parts.host), model, brushes };
}

/**
 * Lists the ids of brushes.
 *
 * @param brushes Brush instances.
 * @returns Brush ids.
 */
function brushToolsApiIds(brushes: readonly SolidBrushInstance[]): string[] {
  return brushes.map((brush) => brush.id);
}

/** Unit tests for the brush geometry MCP tools. */
describe('EditorApi brush tools', () => {
  it('lists every brush tool in the MCP catalog with an undo note', () => {
    for (const name of [
      'hollow_brushes',
      'convex_merge_brushes',
      'flip_brushes',
      'shear_brushes',
      'snap_brush_vertices',
    ]) {
      expect(findMcpTool(name)?.description.toLowerCase()).toContain('undo');
    }
  });

  it('hollows brushes into walls and undoes back to the originals', () => {
    const { api, model, brushes } = brushToolsApiRigCreate();
    const before = model.getBrushCount();
    const firstFaceCount = brushes[0]?.brush.faces.length ?? 0;
    const result = api.invokeTool('hollow_brushes', { brushIds: [brushes[0]?.id], thickness: 0.5 });
    expect(result.ok, result.message).toBe(true);
    const walls = (result.data as { wallBrushIds: string[] }).wallBrushIds;
    expect(walls).toHaveLength(firstFaceCount);
    expect(walls.every((id) => model.findBrush(id) !== undefined)).toBe(true);
    api.invokeTool('undo');
    expect(model.getBrushCount()).toBe(before);
  });

  it('merges brushes into one brush whose id the result returns', () => {
    const { api, model, brushes } = brushToolsApiRigCreate();
    const expected = solidBrushesWorldVertexBounds(brushes);
    const result = api.invokeTool('convex_merge_brushes', { brushIds: brushToolsApiIds(brushes) });
    expect(result.ok, result.message).toBe(true);
    const merged = model.findBrush((result.data as { brushId: string }).brushId);
    expect(merged).toBeDefined();
    if (!merged) return;
    const bounds = solidBrushesWorldVertexBounds([merged]);
    expect(bounds.min.distanceTo(expected.min)).toBeLessThan(1e-4);
    expect(bounds.max.distanceTo(expected.max)).toBeLessThan(1e-4);
  });

  it('flips brushes across the snapped bounds center of the chosen axis', () => {
    const { api, brushes, parts } = brushToolsApiRigCreate();
    const before = solidBrushesWorldVertexBounds(brushes);
    const result = api.invokeTool('flip_brushes', { brushIds: brushToolsApiIds(brushes), axis: 'x' });
    expect(result.ok, result.message).toBe(true);
    const data = result.data as { center: number; brushIds: string[] };
    expect(data.brushIds).toEqual(brushToolsApiIds(brushes));
    expect(data.center).toBeCloseTo(parts.host.gridSnap.snapValue((before.min.x + before.max.x) / 2), 6);
    const after = solidBrushesWorldVertexBounds(brushes);
    expect(after.min.x).toBeCloseTo(2 * data.center - before.max.x, 4);
  });

  it('shears brushes and rejects a missing offset', () => {
    const { api, brushes } = brushToolsApiRigCreate();
    const before = solidBrushesWorldVertexBounds(brushes);
    const offset = 2;
    const result = api.invokeTool('shear_brushes', {
      brushIds: brushToolsApiIds(brushes),
      axis: 'y',
      along: 'z',
      offset,
    });
    expect(result.ok, result.message).toBe(true);
    expect(solidBrushesWorldVertexBounds(brushes).max.z).toBeCloseTo(before.max.z + offset, 4);
    expect(api.invokeTool('shear_brushes', { axis: 'y', along: 'z' }).ok).toBe(false);
  });

  it('snaps brush vertices to whole meters and falls back to the selection without ids', () => {
    const { api, model, parts } = brushToolsApiRigCreate();
    const offGrid = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1.4, 1.4, 1.4), new THREE.Vector3(10.3, 0.2, 0));
    if (offGrid.mesh) parts.host.selectionManager.setSelection([offGrid.mesh]);
    const result = api.invokeTool('snap_brush_vertices', { step: 'integer' });
    expect(result.ok, result.message).toBe(true);
    expect((result.data as { brushIds: string[] }).brushIds).toEqual([offGrid.id]);
    const bounds = solidBrushesWorldVertexBounds([offGrid]);
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-4);
    }
  });

  it('fails with the reason when no brush matches', () => {
    const { api } = brushToolsApiRigCreate();
    const result = api.invokeTool('hollow_brushes', { brushIds: ['missing'] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('needs selected solid brushes');
  });
});

/** Unit tests for the select_by_query MCP tool. */
describe('EditorApi select_by_query', () => {
  it('selects the brushes touching the selected brush and reports their ids', () => {
    const { api, parts, model, brushes } = brushToolsApiRigCreate();
    const first = brushes[0];
    const touching = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 1, 1), new THREE.Vector3(2.5, 0, 0));
    if (first?.mesh) parts.host.selectionManager.setSelection([first.mesh]);
    const result = api.invokeTool('select_by_query', { query: 'touching' });
    expect(result.ok, result.message).toBe(true);
    expect((result.data as { brushIds: string[] }).brushIds).toEqual([touching.id]);
    expect(parts.host.selectionManager.getSelectedObjectCount()).toBe(1);
  });

  it('rejects an unknown query', () => {
    const { api } = brushToolsApiRigCreate();
    expect(api.invokeTool('select_by_query', { query: 'nearby' }).ok).toBe(false);
  });
});
