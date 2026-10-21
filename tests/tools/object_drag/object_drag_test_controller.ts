import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragController } from '@/tools/object_drag/object_drag_controller.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  OBJECT_DRAG_TEST_VIEWPORT_RECT,
  objectDragTestBoxMeshCreate,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from './object_drag_test_viewport.js';

/** A real object drag controller over a small test scene. */
export interface ObjectDragTestControllerRig {
  controller: ObjectDragController;
  testViewport: ObjectDragTestViewport;
  selection: ManagerSelection;
  commandStack: CommandStack;
  gridSnap: GridSnap;
  world: THREE.Group;
  meshes: THREE.Mesh[];
  editing: { allowed: boolean };
}

/**
 * Returns whether a client point lies inside the test viewport rectangle.
 *
 * @param clientX Client X.
 * @param clientY Client Y.
 * @returns True inside the rectangle.
 */
function objectDragTestViewportContains(clientX: number, clientY: number): boolean {
  const rect = OBJECT_DRAG_TEST_VIEWPORT_RECT;
  return rect.left <= clientX && clientX <= rect.right && rect.top <= clientY && clientY <= rect.bottom;
}

/**
 * Creates the brush committer of a test scene (new brushes go into a new
 * model).
 *
 * @param commandStack Undo history.
 * @param world World root.
 * @param selection Selection that receives new brushes.
 * @returns Brush committer.
 */
function objectDragTestBrushCommitCreate(
  commandStack: CommandStack,
  world: THREE.Group,
  selection: ManagerSelection,
): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack,
    worldObject: world,
    selectObject: (mesh) => selection.selectObject(mesh),
    activeModelResolve: () => null,
    brushInsertParentResolve: (model) => model.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
}

/**
 * Builds a controller over a perspective view showing two separate boxes; the
 * move pieces translate the selection but record no undo commands.
 *
 * @returns Test rig.
 */
export function objectDragTestControllerRigCreate(): ObjectDragTestControllerRig {
  const world = new THREE.Group();
  const size = new THREE.Vector3(2, 2, 2);
  const meshes = [
    objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(-3, 1, 0)),
    objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(3, 1, 0)),
  ];
  const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE, meshes);
  const selection = new ManagerSelection();
  const gridSnap = new GridSnap(true, 0.5);
  const commandStack = new CommandStack(32);
  const editing = { allowed: true };
  const controller = new ObjectDragController({
    viewportAtClientPoint: (clientX, clientY) =>
      objectDragTestViewportContains(clientX, clientY) ? testViewport.source : null,
    gridSnap,
    userSnapEnabledRead: () => true,
    objectEditingAllowed: () => editing.allowed,
    selection,
    move: {
      transformExecutor: new TransformExecutor(gridSnap),
      commandStack,
      transformTargetsResolve: () => [...selection.getInspectorObjects(), ...selection.getAllSelectedObjectsAsArray()],
      duplicateHierarchyObjects: () => {},
      translateUndoPush: () => {},
      textureLockRebake: () => {},
      liveVisuals: {},
      afterCommit: () => {},
      afterCancel: () => {},
    },
    brushCommit: objectDragTestBrushCommitCreate(commandStack, world, selection),
    previewHost: { addHelper: () => {}, removeHelper: () => {} },
  });
  return { controller, testViewport, selection, commandStack, gridSnap, world, meshes, editing };
}

/**
 * Returns a world point on the top face center of a mesh.
 *
 * @param mesh Box mesh.
 * @returns World point on its top face.
 */
export function objectDragTestMeshTopCenter(mesh: THREE.Mesh): THREE.Vector3 {
  const bounds = new THREE.Box3().setFromObject(mesh);
  const center = bounds.getCenter(new THREE.Vector3());
  return new THREE.Vector3(center.x, bounds.max.y, center.z);
}
