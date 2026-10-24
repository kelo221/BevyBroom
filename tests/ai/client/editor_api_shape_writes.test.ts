import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { solidGroupShapeRecipeRead } from '@/solid/model/solid_group_shape_recipe.js';

/** Proves the create_shape_brush MCP tool builds grouped, undoable shapes. */
describe('EditorApi create_shape_brush', () => {
  it('creates a grouped multi-piece shape with parameters in one undo entry', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 2, z: 1 } };
    const result = api.invokeTool('create_shape_brush', {
      shapeId: 'stairs',
      min: bounds.min,
      max: bounds.max,
      params: { stepHeight: 0.5 },
    });
    expect(result.ok).toBe(true);
    const modelRoot = parts.world.children[0];
    expect(SolidModel.isSolidModelObject(modelRoot ?? new THREE.Object3D())).toBe(true);
    const model = modelRoot ? SolidModel.fromObject(modelRoot) : null;
    expect(model?.getBrushCount()).toBe(4);
    const group = modelRoot?.children.find((child) => child instanceof THREE.Group);
    expect(group?.name).toBe('Stairs');
    expect(solidGroupShapeRecipeRead(group ?? new THREE.Object3D())?.shapeId).toBe('stairs');
    expect(parts.commandStack.getUndoCount()).toBe(1);
    parts.commandStack.undo();
    expect(parts.world.children.length).toBe(0);
  });

  it('creates a solid cylinder as one brush inside the active model', () => {
    const parts = editorApiTestHostCreate();
    const model = new SolidModel('ShapeTarget');
    parts.world.add(model.root);
    const api = new EditorApi(parts.host);
    const result = api.invokeTool('create_shape_brush', {
      shapeId: 'cylinder',
      modelId: model.root.uuid,
      min: { x: -1, y: 0, z: -1 },
      max: { x: 1, y: 2, z: 1 },
      params: { sides: 6 },
    });
    expect(result.ok).toBe(true);
    expect(model.getBrushCount()).toBe(1);
    const data = result.data as { modelId?: string };
    expect(data.modelId).toBe(model.root.uuid);
  });

  it('rejects unknown shape ids and flat bounds', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const unknown = api.invokeTool('create_shape_brush', {
      shapeId: 'not_a_shape',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
    expect(unknown.ok).toBe(false);
    const flat = api.invokeTool('create_shape_brush', {
      shapeId: 'cuboid',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 0, z: 1 },
    });
    expect(flat.ok).toBe(false);
    expect(parts.commandStack.canUndo()).toBe(false);
  });
});
