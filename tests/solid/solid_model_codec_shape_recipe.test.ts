import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import { solidGroupShapeRecipeRead } from '@/solid/model/solid_group_shape_recipe.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';

/**
 * Draws a stairs group into a solid model.
 *
 * @param stepHeight Step height of the drawn stairs.
 * @returns Model holding one shape group.
 */
function shapeModelCreate(stepHeight: number): SolidModel {
  const model = new SolidModel('ShapeRecipeSolid');
  const commit = new ShapeDrawBrushCommit({
    commandStack: new CommandStack(16),
    worldObject: new THREE.Group(),
    selectObject: () => false,
    activeModelResolve: () => model,
    brushInsertParentResolve: (target) => target.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
  const first = commit.shapeCommit({
    shape: new ShapeDrawShapeStairs(),
    parameters: { stepHeight },
    boundsLocal: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2, 1)),
    gridFrame: new ObjectDragGridFrame(new GridSnap(true, 0.25)),
    upAxis: 'y',
  });
  expect(first).not.toBeNull();
  return model;
}

/** Proves shape group recipes survive solid model persistence. */
describe('solid model codec shape recipes', () => {
  it('omits the recipe field for models without shape groups', () => {
    const model = new SolidModel('PlainSolid');
    model.addBoxBrush(2);
    const encoded = SolidModelCodec.encode(model);
    expect(encoded.hierarchy).toBeUndefined();
  });

  it('round-trips a drawn shape group recipe through encode and decode', () => {
    const stepHeight = 0.5;
    const model = shapeModelCreate(stepHeight);
    const encoded = SolidModelCodec.encode(model);
    const groupNode = encoded.hierarchy?.find((node) => node.kind === 'group');
    expect(groupNode && groupNode.kind === 'group' ? groupNode.shape?.shapeId : undefined).toBe('stairs');
    const restored = SolidModelCodec.decode(encoded, 'RestoredSolid');
    const restoredGroup = restored.root.children.find((child) => child instanceof THREE.Group);
    const recipe = restoredGroup ? solidGroupShapeRecipeRead(restoredGroup) : null;
    expect(recipe?.shapeId).toBe('stairs');
    expect(recipe?.parameters['stepHeight']).toBe(stepHeight);
    expect(recipe?.boundsMin).toEqual([0, 0, 0]);
    expect(recipe?.boundsMax).toEqual([4, 2, 1]);
    expect(recipe?.upAxis).toBe('y');
  });
});
