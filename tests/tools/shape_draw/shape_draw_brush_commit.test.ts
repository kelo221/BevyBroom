import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import { findSolidModelRoot } from '@/solid/model/solid_group.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { SHAPE_DRAW_NEW_MODEL_NAME, ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import type { ShapeDrawWorldBox } from '@/tools/shape_draw/shape_draw_world_box.js';

/** Test scene: world root, history, selection and the active model slot. */
interface BrushCommitScene {
  world: THREE.Group;
  commandStack: CommandStack;
  selection: ManagerSelection;
  commit: ShapeDrawBrushCommit;
  activeModel: { model: SolidModel | null };
}

/**
 * Builds a brush committer over a fresh scene.
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
  const commit = new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: (mesh) => selection.selectObject(mesh),
    activeModelResolve: () => slot.model,
    brushInsertParentResolve: (model) => model.root,
    textureIdResolve: () => textureId,
    afterWorldMutation: () => {},
  });
  return { world, commandStack, selection, commit, activeModel: slot };
}

/**
 * Returns the world-axis bounds of a box placed in the world.
 *
 * @param worldBox World box.
 * @returns Axis-aligned world bounds of the box corners.
 */
function worldBoxBounds(worldBox: ShapeDrawWorldBox): THREE.Box3 {
  const box = new THREE.Box3();
  const half = worldBox.size.clone().multiplyScalar(0.5);
  for (const signX of [-1, 1]) {
    for (const signY of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        const corner = new THREE.Vector3(signX * half.x, signY * half.y, signZ * half.z);
        box.expandByPoint(corner.applyQuaternion(worldBox.orientation).add(worldBox.center));
      }
    }
  }
  return box;
}

/**
 * Asserts two boxes match within a tolerance.
 *
 * @param actual Measured box.
 * @param expected Expected box.
 */
function expectBoxesClose(actual: THREE.Box3, expected: THREE.Box3): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(actual.min[axis]).toBeCloseTo(expected.min[axis], 4);
    expect(actual.max[axis]).toBeCloseTo(expected.max[axis], 4);
  }
}

/**
 * Proves a drawn box becomes one selected, additive, textured brush that fills
 * the drawn world box, in one undo entry, creating a model when needed.
 */
describe('ShapeDrawBrushCommit', () => {
  const worldBox: ShapeDrawWorldBox = {
    center: new THREE.Vector3(2.5, 1, -3),
    size: new THREE.Vector3(3, 2, 1),
    orientation: new THREE.Quaternion(),
  };

  it('creates a World model, an additive brush filling the box and selects it in one undo entry', () => {
    const textureId = 'texture_shape_draw_test';
    const scene = brushCommitSceneCreate(null, textureId);
    const mesh = scene.commit.brushCommit(worldBox);
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
    mesh.updateMatrixWorld(true);
    expectBoxesClose(new THREE.Box3().setFromObject(mesh), worldBoxBounds(worldBox));
    expect(scene.commandStack.getUndoCount()).toBe(1);
    scene.commandStack.undo();
    expect(mesh.parent).toBeNull();
    expect(scene.world.children.length).toBe(0);
  });

  it('adds the brush to the active model with the requested texture and additive operation', () => {
    const model = new SolidModel('ActiveModel');
    const textureId = 'texture_shape_draw_active';
    const scene = brushCommitSceneCreate(model, textureId);
    const mesh = scene.commit.brushCommit(worldBox);
    const brush = mesh ? model.findBrushByMesh(mesh) : undefined;
    expect(brush).toBeDefined();
    expect(brush?.operation).toBe(SolidOperation.Additive);
    expect(brush?.getSurfaceTextureId(0)).toBe(textureId);
    expect(scene.world.children).toEqual([model.root]);
    expect(scene.commandStack.getUndoCount()).toBe(1);
  });

  it('fills the world box even when the model root is moved, turned and scaled', () => {
    const model = new SolidModel('TransformedModel');
    model.root.position.set(-4, 2, 7);
    model.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    model.root.scale.set(2, 2, 2);
    const scene = brushCommitSceneCreate(model, null);
    scene.world.updateMatrixWorld(true);
    const mesh = scene.commit.brushCommit(worldBox);
    expect(mesh).not.toBeNull();
    mesh?.updateMatrixWorld(true);
    if (mesh) {
      expectBoxesClose(new THREE.Box3().setFromObject(mesh), worldBoxBounds(worldBox));
    }
  });
});
