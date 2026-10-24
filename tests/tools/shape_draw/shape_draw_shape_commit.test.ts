import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { isSolidCsgGroup } from '@/solid/model/solid_group.js';
import { solidGroupShapeRecipeRead } from '@/solid/model/solid_group_shape_recipe.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';

/** Test scene for multi-piece shape commits. */
interface ShapeCommitScene {
  world: THREE.Group;
  commandStack: CommandStack;
  selection: ManagerSelection;
  commit: ShapeDrawBrushCommit;
  gridFrame: ObjectDragGridFrame;
}

/**
 * Builds a committer over a fresh world.
 *
 * @returns Scene pieces.
 */
function shapeCommitSceneCreate(): ShapeCommitScene {
  const world = new THREE.Group();
  const commandStack = new CommandStack(64);
  const selection = new ManagerSelection();
  const commit = new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: (mesh) => selection.selectObject(mesh),
    selectObjects: (meshes) => selection.setSelection(meshes),
    activeModelResolve: () => null,
    brushInsertParentResolve: (model) => model.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
  return { world, commandStack, selection, commit, gridFrame: new ObjectDragGridFrame(new GridSnap(true, 0.25)) };
}

/**
 * Commits stairs with a step height into bounds.
 *
 * @param scene Test scene.
 * @param bounds Grid-local bounds.
 * @param stepHeight Step height parameter.
 * @returns First created mesh, or null.
 */
function stairsCommit(scene: ShapeCommitScene, bounds: THREE.Box3, stepHeight: number): THREE.Mesh | null {
  return scene.commit.shapeCommit({
    shape: new ShapeDrawShapeStairs(),
    parameters: { stepHeight },
    boundsLocal: bounds,
    gridFrame: scene.gridFrame,
    upAxis: 'y',
  });
}

/**
 * Finds the shape group of a created mesh.
 *
 * @param mesh Brush mesh inside the group.
 * @returns Owning group, or null.
 */
function shapeGroupOf(mesh: THREE.Mesh): THREE.Group | null {
  let current: THREE.Object3D | null = mesh.parent;
  while (current) {
    if (solidGroupShapeRecipeRead(current)) {
      return current as THREE.Group;
    }
    current = current.parent;
  }
  return null;
}

/** Proves multi-piece shapes commit as one grouped, undoable whole. */
describe('ShapeDrawBrushCommit multi-piece shapes', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2, 1));

  it('groups every step under one named solid CSG group with its recipe', () => {
    const scene = shapeCommitSceneCreate();
    const stepHeight = 0.5;
    const mesh = stairsCommit(scene, bounds, stepHeight);
    expect(mesh).not.toBeNull();
    if (!mesh) {
      return;
    }
    const group = shapeGroupOf(mesh);
    expect(group).not.toBeNull();
    expect(group?.name).toBe('Stairs');
    expect(isSolidCsgGroup(group as THREE.Object3D)).toBe(true);
    const recipe = group ? solidGroupShapeRecipeRead(group) : null;
    expect(recipe?.shapeId).toBe('stairs');
    expect(recipe?.parameters['stepHeight']).toBe(stepHeight);
    expect(recipe?.upAxis).toBe('y');
  });

  it('creates every step as a brush in one undo entry and undoes them all', () => {
    const scene = shapeCommitSceneCreate();
    const stepHeight = 0.5;
    const stepCount = Math.ceil((bounds.max.y - bounds.min.y) / stepHeight);
    const mesh = stairsCommit(scene, bounds, stepHeight);
    const group = mesh ? shapeGroupOf(mesh) : null;
    expect(group?.children.length).toBe(stepCount);
    expect(group?.parent?.name).toBe('World');
    expect(scene.commandStack.getUndoCount()).toBe(1);
    scene.commandStack.undo();
    expect(group?.parent).toBeNull();
    expect(scene.world.children.length).toBe(0);
  });

  it('selects every created piece mesh', () => {
    const scene = shapeCommitSceneCreate();
    const stepHeight = 0.5;
    stairsCommit(scene, bounds, stepHeight);
    const stepCount = Math.ceil((bounds.max.y - bounds.min.y) / stepHeight);
    expect(scene.selection.getAllSelectedObjectsAsArray()).toHaveLength(stepCount);
  });

  it('keeps single-piece shapes ungrouped', () => {
    const scene = shapeCommitSceneCreate();
    const mesh = stairsCommit(scene, bounds, 2);
    expect(mesh).not.toBeNull();
    expect(mesh?.parent).not.toBeNull();
    expect(shapeGroupOf(mesh as THREE.Mesh)).toBeNull();
  });
});
