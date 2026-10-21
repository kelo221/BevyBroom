import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { ClipboardMemory } from '@/clipboard/controller/clipboard_memory.js';
import { ControllerClipboard, type ControllerClipboardHost } from '@/clipboard/controller/controller_clipboard.js';
import type { ClipboardPlacementViewportPoint } from '@/clipboard/placement/clipboard_placement_cursor.js';

/** A world, its history, selection, layers and a clipboard controller over them. */
export interface ClipboardTestWorld {
  world: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  layerManager: LayerManager;
  controller: ControllerClipboard;
  statusMessages: string[];
  /**
   * View and pointer the next paste at the cursor uses; null pastes at the
   * copied position.
   */
  viewportPoint: ClipboardPlacementViewportPoint | null;
  /** Grid step pastes snap to. */
  gridInterval: number;
}

/**
 * Returns the first solid model found in a world.
 *
 * @param world World root.
 * @returns Solid model, or null when the world has none.
 */
export function clipboardTestSolidModelFind(world: THREE.Object3D): SolidModel | null {
  const root = world.children.find((child) => SolidModel.isSolidModelObject(child));
  return root === undefined ? null : SolidModel.fromObject(root);
}

/**
 * Builds the clipboard host over a test world.
 *
 * @param testWorld Test world whose parts the host reads.
 * @returns Clipboard controller host.
 */
function clipboardTestHostCreate(testWorld: Omit<ClipboardTestWorld, 'controller'>): ControllerClipboardHost {
  const objectActions = new HandlerObjectAction(testWorld.world, testWorld.commandStack, testWorld.selectionManager);
  return {
    worldObject: testWorld.world,
    commandStack: testWorld.commandStack,
    selectionManager: testWorld.selectionManager,
    memory: new ClipboardMemory(),
    solidModelResolve: () => clipboardTestSolidModelFind(testWorld.world),
    hierarchyObjectsDelete: (objects) => objectActions.deleteHierarchyObjects(objects),
    viewportPointRead: () => testWorld.viewportPoint,
    gridIntervalRead: () => testWorld.gridInterval,
    refreshAfterWorldMutation: () => undefined,
    showStatusMessage: (message) => testWorld.statusMessages.push(message),
  };
}

/**
 * Creates an empty world with layers, history, selection and a clipboard
 * controller.
 *
 * @returns Test world.
 */
export function clipboardTestWorldCreate(): ClipboardTestWorld {
  const world = new THREE.Group();
  world.name = 'World';
  const testWorld: Omit<ClipboardTestWorld, 'controller'> & { controller?: ControllerClipboard } = {
    world,
    commandStack: new CommandStack(64),
    selectionManager: new ManagerSelection(),
    layerManager: new LayerManager(world),
    statusMessages: [],
    viewportPoint: null,
    gridInterval: 0,
  };
  const controller = new ControllerClipboard(clipboardTestHostCreate(testWorld));
  return Object.assign(testWorld, { controller });
}

/**
 * Adds a solid model to a world.
 *
 * @param world World root.
 * @param name Model name.
 * @returns The added model.
 */
export function clipboardTestModelAdd(world: THREE.Object3D, name: string): SolidModel {
  const model = new SolidModel(name);
  world.add(model.root);
  return model;
}

/**
 * Adds an additive box brush to a model at a local position.
 *
 * @param model Solid model.
 * @param position Brush position in model space.
 * @param parent Solid CSG group to add under, or null for the model root.
 * @returns The added brush.
 */
export function clipboardTestBrushAdd(
  model: SolidModel,
  position: THREE.Vector3,
  parent: THREE.Object3D | null = null,
): SolidBrushInstance {
  const brush = model.addBoxBrush(2, SolidOperation.Additive, parent, false);
  model.setBrushTransform(brush.id, position);
  model.rebuild(true);
  return brush;
}

/**
 * Returns the mesh of a brush, failing the test when it has none.
 *
 * @param brush Brush instance.
 * @returns Brush preview mesh.
 */
export function clipboardTestBrushMeshRead(brush: SolidBrushInstance): THREE.Mesh {
  const mesh = brush.mesh;
  if (mesh === null) {
    throw new Error('The test brush has no mesh');
  }
  return mesh;
}

/**
 * Returns the world-space position of an object.
 *
 * @param object Scene object.
 * @returns World position.
 */
export function clipboardTestWorldPositionRead(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
}

/**
 * Selects objects the way a click in the outliner does.
 *
 * @param testWorld Test world.
 * @param objects Hierarchy objects to select.
 */
export function clipboardTestSelect(testWorld: ClipboardTestWorld, objects: THREE.Object3D[]): void {
  testWorld.selectionManager.setSelection(selectionMeshesFromHierarchyCollect(objects), objects);
}

/**
 * Copies the given objects through the controller and returns the text.
 *
 * @param testWorld Test world.
 * @param objects Hierarchy objects to copy.
 * @returns Clipboard text.
 */
export function clipboardTestCopy(testWorld: ClipboardTestWorld, objects: THREE.Object3D[]): string {
  clipboardTestSelect(testWorld, objects);
  const copied = testWorld.controller.copy();
  if (copied === null) {
    throw new Error('Nothing was copied');
  }
  return copied.text;
}
