import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import {
  ObjectDragController,
  type ObjectDragControllerDeps,
  type ObjectDragControllerMoveDeps,
} from '@/tools/object_drag/object_drag_controller.js';
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
 * Builds the shape-draw and preview dependencies of the controller rig.
 *
 * @param world World root of the rig.
 * @param commandStack Undo history of the rig.
 * @param selection Selection manager of the rig.
 * @returns Draw dependencies spread into the controller deps.
 */
function objectDragTestShapeDepsCreate(
  world: THREE.Group,
  commandStack: CommandStack,
  selection: ManagerSelection,
): Pick<ObjectDragControllerDeps, 'brushCommit' | 'shapeSettings' | 'previewHost'> {
  return {
    brushCommit: objectDragTestBrushCommitCreate(commandStack, world, selection),
    shapeSettings: new ShapeDrawSettings(),
    previewHost: { addHelper: () => {}, removeHelper: () => {} },
  };
}

/**
 * Builds the move-session dependencies of the controller rig.
 *
 * @param gridSnap Grid snap of the rig.
 * @param commandStack Undo history of the rig.
 * @param selection Selection manager of the rig.
 * @returns Move dependencies.
 */
function objectDragTestMoveDepsCreate(
  gridSnap: GridSnap,
  commandStack: CommandStack,
  selection: ManagerSelection,
): ObjectDragControllerMoveDeps {
  return {
    transformExecutor: new TransformExecutor(gridSnap),
    commandStack,
    transformTargetsResolve: () => [...selection.getInspectorObjects(), ...selection.getAllSelectedObjectsAsArray()],
    duplicateHierarchyObjects: () => {},
    translateUndoPush: () => {},
    textureLockRebake: () => {},
    liveVisuals: {},
    afterCommit: () => {},
    afterCancel: () => {},
  };
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
  const meshes = objectDragTestSceneMeshesCreate(world, size);
  const testViewport = objectDragTestViewportCreate(ViewportKind.PERSPECTIVE, meshes);
  const selection = new ManagerSelection();
  const gridSnap = new GridSnap(true, 0.5);
  const commandStack = new CommandStack(32);
  const editing = { allowed: true };
  const controller = new ObjectDragController({
    ...objectDragTestControllerDepsCreate(testViewport, gridSnap, commandStack, selection, editing, world),
  });
  return { controller, testViewport, selection, commandStack, gridSnap, world, meshes, editing };
}

/**
 * Creates the two separated scene boxes of the rig.
 *
 * @param world World root receiving the boxes.
 * @param size Box size.
 * @returns Created box meshes.
 */
function objectDragTestSceneMeshesCreate(world: THREE.Group, size: THREE.Vector3): THREE.Mesh[] {
  return [
    objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(-3, 1, 0)),
    objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(3, 1, 0)),
  ];
}

/**
 * Builds the controller dependencies of the rig.
 *
 * @param testViewport Viewport of the rig.
 * @param gridSnap Grid snap of the rig.
 * @param commandStack Undo history of the rig.
 * @param selection Selection manager of the rig.
 * @param editing Editing flag holder of the rig.
 * @param world World root of the rig.
 * @returns Controller dependencies.
 */
function objectDragTestControllerDepsCreate(
  testViewport: ReturnType<typeof objectDragTestViewportCreate>,
  gridSnap: GridSnap,
  commandStack: CommandStack,
  selection: ManagerSelection,
  editing: { allowed: boolean },
  world: THREE.Group,
): ObjectDragControllerDeps {
  return {
    viewportAtClientPoint: (clientX, clientY) =>
      objectDragTestViewportContains(clientX, clientY) ? testViewport.source : null,
    gridSnap,
    userSnapEnabledRead: () => true,
    objectEditingAllowed: () => editing.allowed,
    selection,
    move: objectDragTestMoveDepsCreate(gridSnap, commandStack, selection),
    ...objectDragTestShapeDepsCreate(world, commandStack, selection),
  };
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
