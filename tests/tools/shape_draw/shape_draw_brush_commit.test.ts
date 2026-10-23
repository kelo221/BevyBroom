import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import { findSolidModelRoot } from '@/solid/model/solid_group.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { SHAPE_DRAW_NEW_MODEL_NAME, ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { ShapeDrawShapeCuboid } from '@/tools/shape_draw/shapes/shape_draw_shape_cuboid.js';

/** Test scene: world root, history, selection and the active model slot. */
interface BrushCommitScene {
  world: THREE.Group;
  commandStack: CommandStack;
  selection: ManagerSelection;
  commit: ShapeDrawBrushCommit;
  gridFrame: ObjectDragGridFrame;
  activeModel: { model: SolidModel | null };
}

/**
 * Builds a shape committer over a fresh scene.
 *
 * @param activeModel Model new brushes join, or null when the scene has none.
 * @param textureId Texture new brushes receive.
 * @returns Scene pieces.
 */
function brushCommitSceneCreate(activeModel: SolidModel | null, textureId: string | null): BrushCommitScene {
  const world = new THREE.Group();
  const commandStack = new CommandStack(64);
  const selection = new ManagerSelection();
  const slot = { model: activeModel };
  if (activeModel) {
    world.add(activeModel.root);
  }
  return {
    world,
    commandStack,
    selection,
    commit: brushCommitCreate(world, commandStack, selection, slot, textureId),
    gridFrame: new ObjectDragGridFrame(new GridSnap(true, 0.25)),
    activeModel: slot,
  };
}

/**
 * Builds the shape committer over the scene systems.
 *
 * @param world World root.
 * @param commandStack Undo history.
 * @param selection Selection manager.
 * @param slot Active model slot.
 * @param textureId Texture new brushes receive.
 * @returns Shape committer.
 */
function brushCommitCreate(
  world: THREE.Group,
  commandStack: CommandStack,
  selection: ManagerSelection,
  slot: { model: SolidModel | null },
  textureId: string | null,
): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: (mesh) => selection.selectObject(mesh),
    selectObjects: (meshes) => selection.setSelection(meshes),
    activeModelResolve: () => slot.model,
    brushInsertParentResolve: (model) => model.root,
    textureIdResolve: () => textureId,
    afterWorldMutation: () => {},
  });
}

/**
 * Commits the cuboid shape filling a bounds box.
 *
 * @param scene Test scene.
 * @param bounds Grid-local bounds the cuboid must fill.
 * @returns First created mesh, or null.
 */
function cuboidCommit(scene: BrushCommitScene, bounds: THREE.Box3): THREE.Mesh | null {
  return scene.commit.shapeCommit({
    shape: new ShapeDrawShapeCuboid(),
    parameters: {},
    boundsLocal: bounds,
    gridFrame: scene.gridFrame,
    upAxis: 'y',
  });
}

/**
 * Asserts a mesh matches bounds within a tolerance.
 *
 * @param mesh Mesh to measure.
 * @param expected Expected world bounds.
 */
function expectMeshFillsBounds(mesh: THREE.Mesh, expected: THREE.Box3): void {
  mesh.updateMatrixWorld(true);
  const actual = new THREE.Box3().setFromObject(mesh);
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(actual.min[axis]).toBeCloseTo(expected.min[axis], 4);
    expect(actual.max[axis]).toBeCloseTo(expected.max[axis], 4);
  }
}

/**
 * Proves a drawn shape becomes selected, additive, textured brushes that fill
 * the drawn bounds, in one undo entry, creating a model when needed.
 */
describe('ShapeDrawBrushCommit', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(1, 0, -4), new THREE.Vector3(4, 2, -3));

  it('creates a World model, an additive brush filling the bounds and selects it in one undo entry', () => {
    const textureId = 'texture_shape_draw_test';
    const scene = brushCommitSceneCreate(null, textureId);
    const mesh = cuboidCommit(scene, bounds);
    expect(mesh).not.toBeNull();
    if (!mesh) {
      return;
    }
    const modelRoot = findSolidModelRoot(mesh);
    expect(modelRoot?.parent).toBe(scene.world);
    const model = modelRoot ? SolidModelRegistry.fromObject(modelRoot) : null;
    expect(model?.root.name).toBe(SHAPE_DRAW_NEW_MODEL_NAME);
    expect(model?.findBrushByMesh(mesh)?.getSurfaceTextureId(0)).toBe(textureId);
    expect(scene.selection.getAllSelectedObjectsAsArray()).toEqual([mesh]);
    expectMeshFillsBounds(mesh, bounds);
    expect(scene.commandStack.getUndoCount()).toBe(1);
    scene.commandStack.undo();
    expect(mesh.parent).toBeNull();
    expect(scene.world.children.length).toBe(0);
  });

  it('adds the brush to the active model with the requested texture and additive operation', () => {
    const model = new SolidModel('ActiveModel');
    const textureId = 'texture_shape_draw_active';
    const scene = brushCommitSceneCreate(model, textureId);
    const mesh = cuboidCommit(scene, bounds);
    const brush = mesh ? model.findBrushByMesh(mesh) : undefined;
    expect(brush).toBeDefined();
    expect(brush?.operation).toBe(SolidOperation.Additive);
    expect(brush?.getSurfaceTextureId(0)).toBe(textureId);
    expect(scene.world.children).toEqual([model.root]);
    expect(scene.commandStack.getUndoCount()).toBe(1);
  });

  it('fills the drawn bounds even when the model root is moved, turned and scaled', () => {
    const model = new SolidModel('TransformedModel');
    model.root.position.set(-4, 2, 7);
    model.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    model.root.scale.set(2, 2, 2);
    const scene = brushCommitSceneCreate(model, null);
    scene.world.updateMatrixWorld(true);
    const mesh = cuboidCommit(scene, bounds);
    expect(mesh).not.toBeNull();
    if (mesh) {
      expectMeshFillsBounds(mesh, bounds);
    }
  });
});
