import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { solidGroupShapeRecipeRead } from '@/solid/model/solid_group_shape_recipe.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { HandlerShapeDrawRegenerate } from '@/tools/shape_draw/handler_shape_draw_regenerate.js';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';
import { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';

/** Test scene around one drawn stairs group. */
interface RegenerateScene {
  world: THREE.Group;
  commandStack: CommandStack;
  selection: ManagerSelection;
  settings: ShapeDrawSettings;
  commit: ShapeDrawBrushCommit;
  gridFrame: ObjectDragGridFrame;
}

/**
 * Draws a stairs group into a fresh model and selects its brushes.
 *
 * @param stepHeight Step height used for the initial draw.
 * @returns Scene pieces.
 */
function regenerateSceneCreate(stepHeight: number): RegenerateScene {
  const world = new THREE.Group();
  const model = new SolidModel('RegenModel');
  world.add(model.root);
  const commandStack = new CommandStack(64);
  const selection = new ManagerSelection();
  const settings = new ShapeDrawSettings();
  settings.shapeSelect('stairs');
  const commit = regenerateCommitCreate(world, model, commandStack, selection);
  const gridFrame = new ObjectDragGridFrame(new GridSnap(true, 0.25));
  selection.setSelection(drawStairs(commit, gridFrame, stepHeight));
  return { world, commandStack, selection, settings, commit, gridFrame };
}

/**
 * Builds the committer drawing into the regeneration model.
 *
 * @param world World root.
 * @param model Model the stairs join.
 * @param commandStack Undo history.
 * @param selection Selection manager.
 * @returns Shape committer.
 */
function regenerateCommitCreate(
  world: THREE.Group,
  model: SolidModel,
  commandStack: CommandStack,
  selection: ManagerSelection,
): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: (mesh) => selection.selectObject(mesh),
    selectObjects: (meshes) => selection.setSelection(meshes),
    activeModelResolve: () => model,
    brushInsertParentResolve: (target) => target.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
}

/**
 * Commits stairs into bounds and returns the created meshes.
 *
 * @param commit Committer.
 * @param gridFrame Grid frame of the draw.
 * @param stepHeight Step height used for the draw.
 * @returns Created piece meshes.
 */
function drawStairs(commit: ShapeDrawBrushCommit, gridFrame: ObjectDragGridFrame, stepHeight: number): THREE.Mesh[] {
  const bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2, 1));
  const first = commit.shapeCommit({
    shape: new ShapeDrawShapeStairs(),
    parameters: { stepHeight },
    boundsLocal: bounds,
    gridFrame,
    upAxis: 'y',
  });
  const group = first?.parent ?? null;
  return group ? (group.children as THREE.Mesh[]) : first ? [first] : [];
}

/**
 * Runs the regeneration over the scene selection.
 *
 * @param scene Test scene.
 * @returns Number of groups rebuilt.
 */
function regenerateRun(scene: RegenerateScene): number {
  const handler = new HandlerShapeDrawRegenerate(
    {
      commandStack: scene.commandStack,
      getSelectedObjects: () => scene.selection.getAllSelectedObjectsAsArray(),
      showStatusMessage: () => {},
    },
    scene.settings,
  );
  return handler.run();
}

/** Proves parameter changes rebuild selected shape groups in place. */
describe('HandlerShapeDrawRegenerate', () => {
  it('replaces the group brushes with the new step count in one undo entry', () => {
    const scene = regenerateSceneCreate(0.5);
    scene.settings.parameterSet('stairs', 'stepHeight', 1);
    const group = scene.selection.getAllSelectedObjectsAsArray()[0]?.parent;
    const undoCountBefore = scene.commandStack.getUndoCount();
    const rebuilt = regenerateRun(scene);
    expect(rebuilt).toBe(1);
    expect(group?.children.length).toBe(2);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    scene.commandStack.undo();
    expect(group?.children.length).toBe(4);
    expect(solidGroupShapeRecipeRead(group as THREE.Group)?.parameters['stepHeight']).toBe(0.5);
  });

  it('stores the new parameters on the group recipe', () => {
    const scene = regenerateSceneCreate(0.5);
    const group = scene.selection.getAllSelectedObjectsAsArray()[0]?.parent;
    scene.settings.parameterSet('stairs', 'stepHeight', 0.25);
    regenerateRun(scene);
    expect(solidGroupShapeRecipeRead(group as THREE.Group)?.parameters['stepHeight']).toBe(0.25);
  });

  it('does nothing when the selected group belongs to another shape', () => {
    const scene = regenerateSceneCreate(0.5);
    scene.settings.shapeSelect('cylinder');
    scene.settings.parameterSet('cylinder', 'sides', 12);
    const undoCountBefore = scene.commandStack.getUndoCount();
    expect(regenerateRun(scene)).toBe(0);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore);
  });

  it('does nothing when the selection holds unrelated objects', () => {
    const scene = regenerateSceneCreate(0.5);
    scene.selection.clearSelection();
    scene.selection.selectObject(new THREE.Mesh());
    scene.settings.parameterSet('stairs', 'stepHeight', 1);
    expect(regenerateRun(scene)).toBe(0);
  });
});
