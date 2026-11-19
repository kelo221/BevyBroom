import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import {
  GRID_TEST_OFF_GRID_OFFSET,
  gridTestBrushAdd,
  gridTestMeshAdd,
} from '../../grid_conformance/grid_conformance_test_scene.js';

/**
 * Counts the brushes of every solid model under the world.
 *
 * @param world World group.
 * @returns Brush count.
 */
function brushCountRead(world: THREE.Object3D): number {
  let count = 0;
  for (const child of world.children) {
    count += SolidModel.fromObject(child)?.getBrushCount() ?? 0;
  }
  return count;
}

/**
 * Adds an empty solid model to the test world.
 *
 * @param parts Test host parts.
 * @returns Uuid of the model root.
 */
function modelIdCreate(parts: EditorApiTestHostParts): string {
  const model = new SolidModel('GridRuleModel');
  parts.world.add(model.root);
  return model.root.uuid;
}

/** Proves AI tool calls cannot leave new geometry off the minimum grid. */
describe('EditorApi grid rule', () => {
  it('keeps a box brush placed on the grid', () => {
    const parts = editorApiTestHostCreate();
    const result = new EditorApi(parts.host).invokeTool('add_box_brush', {
      modelId: modelIdCreate(parts),
      position: { x: 1, y: 0.5, z: GRID_INTERVAL_MINIMUM * 3 },
      size: { x: 2, y: 1, z: GRID_INTERVAL_MINIMUM * 2 },
      exact: true,
    });
    expect(result.ok, result.message).toBe(true);
    expect(brushCountRead(parts.world)).toBe(1);
  });

  it('rejects and undoes a box brush placed off the grid', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const modelId = modelIdCreate(parts);
    api.invokeTool('add_box_brush', { modelId, position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } });
    const countBefore = brushCountRead(parts.world);
    expect(countBefore).toBe(1);
    const result = api.invokeTool('add_box_brush', {
      modelId,
      position: { x: 3 + GRID_TEST_OFF_GRID_OFFSET, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      exact: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(String(GRID_INTERVAL_MINIMUM));
    expect(brushCountRead(parts.world)).toBe(countBefore);
  });

  it('rejects moving an existing brush off the grid and restores its position', () => {
    const parts = editorApiTestHostCreate();
    const { brush } = gridTestBrushAdd(parts.world, new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(1, 1, 1));
    const result = new EditorApi(parts.host).invokeTool('set_brush_transform', {
      brushId: brush.id,
      position: { x: GRID_TEST_OFF_GRID_OFFSET, y: 0.5, z: 0 },
      exact: true,
    });
    expect(result.ok).toBe(false);
    brush.pullTransformFromMesh();
    expect(brush.position.x).toBeCloseTo(0, 6);
  });

  it('allows edits while older geometry is already off the grid', () => {
    const parts = editorApiTestHostCreate();
    const { model } = gridTestBrushAdd(
      parts.world,
      new THREE.Vector3(GRID_TEST_OFF_GRID_OFFSET, 0, 0),
      new THREE.Vector3(1, 1, 1),
    );
    const result = new EditorApi(parts.host).invokeTool('add_box_brush', {
      modelId: model.root.uuid,
      position: { x: 4, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
    });
    expect(result.ok, result.message).toBe(true);
  });

  it('accepts a ramp slope drawn inside grid bounds', () => {
    const parts = editorApiTestHostCreate();
    const result = new EditorApi(parts.host).invokeTool('create_shape_brush', {
      shapeId: 'ramp',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 4, y: 1, z: 2 },
      params: { direction: '-z' },
    });
    expect(result.ok, result.message).toBe(true);
    expect(brushCountRead(parts.world)).toBe(1);
  });

  it('warns to use brushes when a call creates an editable mesh', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const mesh = gridTestMeshAdd(parts.world, new THREE.Vector3(0.5, 0.5, 0.5));
    parts.host.selectionManager.setSelection(selectionMeshesFromHierarchyCollect([mesh]), [mesh]);
    const copied = api.invokeTool('copy_selection');
    expect(copied.ok, copied.message).toBe(true);
    const pasted = api.invokeTool('paste_objects', {
      text: (copied.data as { text: string }).text,
      atOriginalPosition: true,
    });
    expect(pasted.ok, pasted.message).toBe(true);
    expect((pasted.warnings ?? []).join(' ')).toContain('brushes');
  });

  it('adds no mesh warning when a call creates only brushes', () => {
    const parts = editorApiTestHostCreate();
    const result = new EditorApi(parts.host).invokeTool('add_box_brush', {
      modelId: modelIdCreate(parts),
      position: { x: 0, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
    });
    expect(result.ok, result.message).toBe(true);
    expect(result.warnings ?? []).toEqual([]);
  });
});
