import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ManagerInput } from '@/input/manager_input.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { HandlerHierarchyReparent } from '@/outliner/hierarchy/handler_hierarchy_reparent.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { ControllerShearDrag } from '@/transform/shear/controller_shear_drag.js';
import { HandlerComponentTransform } from '@/edit/transform/handler_component_transform.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSnap } from '@/transform/snap/manager_snap.js';
import { CommandStack } from '@/commands/command_stack.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { TerrainGenerator } from '@/terrain/terrain_generator.js';
import { DEFAULT_COMMAND_STACK_MAX_SIZE, DEFAULT_GRID_SNAP_INTERVAL } from '@/types/editor_config.js';
import { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { EntityHandleSystem } from '@/entity/handles/entity_handle_system.js';
import { EntitySelectionFollower } from '@/entity/selection/entity_selection_follower.js';
import { LayerSystem } from '@/layer/layer_system.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/** Core editor services created before the DOM shell exists. */
export interface LayoutCoreSystems {
  inputManager: ManagerInput;
  worldObject: THREE.Group;
  selectionManager: ManagerSelection;
  primitiveTool: ToolPrimitiveCreation;
  gridSnap: GridSnap;
  userSnapEnabled: boolean;
  snapManager: ManagerSnap;
  transformConstraint: TransformConstraint;
  transformExecutor: TransformExecutor;
  transformGizmo: GizmoTransform;
  gizmoRaycaster: GizmoRaycaster;
  commandStack: CommandStack;
  transformHandler: HandlerTransform;
  componentTransformHandler: HandlerComponentTransform;
  entityHandles: EntityHandleSystem;
  entitySelectionFollower: EntitySelectionFollower;
  layerSystem: LayerSystem;
  layerManager: LayerManager;
  textureLock: TextureLockSettings;
  hierarchyReparentHandler: HandlerHierarchyReparent;
  clipPlaneTool: ToolClipPlane;
  editorOverlayPolicy: PolicyEditorOverlay;
  modalToolSessionRegistry: RegistryModalToolSession;
  terrainGenerator: TerrainGenerator;
  lastTime: number;
  animationFrameId: number | null;
  resizeObserver: ResizeObserver | null;
  isDisposed: boolean;
  isRunning: boolean;
}

/**
 * Constructs core managers that do not depend on DOM layout.
 *
 * @returns Bundle of core editor services and runtime flags.
 */
export function createLayoutCoreSystems(): LayoutCoreSystems {
  const worldObject = new THREE.Group();
  const snapBundle = createSnapAndTransformStack();
  const textureLock = new TextureLockSettings(true, false);
  snapBundle.transformHandler.setTextureLockSettings(textureLock);
  snapBundle.transformHandler.setShearDragController(
    new ControllerShearDrag(
      snapBundle.transformHandler.getDragSession(),
      snapBundle.transformGizmo,
      snapBundle.gizmoRaycaster,
      snapBundle.transformExecutor,
      {
        commandStack: snapBundle.commandStack,
        isTexturePositionLockEnabled: () => textureLock.isPositionLocked(),
        showStatusMessage: (_message: string) => undefined,
      },
    ),
  );
  const sceneRoot = createSceneRootServices(worldObject, snapBundle.commandStack);
  return {
    ...createRuntimeState(),
    ...sceneRoot,
    ...snapBundle,
    entityHandles: createEntityHandleSystem(worldObject, sceneRoot.selectionManager, snapBundle),
    entitySelectionFollower: new EntitySelectionFollower(sceneRoot.selectionManager),
    textureLock,
    clipPlaneTool: new ToolClipPlane(),
    editorOverlayPolicy: new PolicyEditorOverlay(),
    modalToolSessionRegistry: new RegistryModalToolSession(),
    terrainGenerator: new TerrainGenerator(),
    userSnapEnabled: true,
  };
}

/**
 * Creates the handles of selected entities, snapping with the grid snap and
 * pushing finished drags onto the shared undo stack.
 *
 * @param worldObject Scene root group.
 * @param selectionManager Object selection.
 * @param snapBundle Snap and transform services.
 * @returns Entity handle system.
 */
function createEntityHandleSystem(
  worldObject: THREE.Group,
  selectionManager: ManagerSelection,
  snapBundle: Pick<LayoutCoreSystems, 'commandStack' | 'gridSnap'>,
): EntityHandleSystem {
  return new EntityHandleSystem({
    worldObject,
    selection: selectionManager,
    commandStack: snapBundle.commandStack,
    snap: snapBundle.gridSnap,
  });
}

/**
 * Creates runtime loop flags shared by the layout manager.
 *
 * @returns Runtime state fields for core systems.
 */
function createRuntimeState(): Pick<
  LayoutCoreSystems,
  'inputManager' | 'lastTime' | 'animationFrameId' | 'resizeObserver' | 'isDisposed' | 'isRunning'
> {
  return {
    inputManager: new ManagerInput(),
    lastTime: performance.now(),
    animationFrameId: null,
    resizeObserver: null,
    isDisposed: false,
    isRunning: false,
  };
}

/**
 * Creates world root, selection, layers, primitive tool, and hierarchy
 * services.
 *
 * @param worldObject Scene root group.
 * @param commandStack Shared undo stack.
 * @returns Scene hierarchy service fields.
 */
function createSceneRootServices(
  worldObject: THREE.Group,
  commandStack: CommandStack,
): Pick<
  LayoutCoreSystems,
  'worldObject' | 'selectionManager' | 'layerSystem' | 'layerManager' | 'primitiveTool' | 'hierarchyReparentHandler'
> {
  const selectionManager = new ManagerSelection();
  const layerSystem = new LayerSystem(worldObject, selectionManager);
  return {
    worldObject,
    selectionManager,
    layerSystem,
    layerManager: layerSystem.layerManager,
    primitiveTool: new ToolPrimitiveCreation(worldObject),
    hierarchyReparentHandler: new HandlerHierarchyReparent(worldObject, commandStack),
  };
}

/**
 * Creates grid snap, command stack, and transform gizmo services.
 *
 * @returns Snap and transform subsystem bundle.
 */
function createSnapAndTransformStack(): Pick<
  LayoutCoreSystems,
  | 'gridSnap'
  | 'snapManager'
  | 'transformConstraint'
  | 'transformExecutor'
  | 'transformGizmo'
  | 'gizmoRaycaster'
  | 'commandStack'
  | 'transformHandler'
  | 'componentTransformHandler'
> {
  const gridSnap = new GridSnap(true, DEFAULT_GRID_SNAP_INTERVAL);
  const transformGizmo = new GizmoTransform(Theme);
  const gizmoRaycaster = new GizmoRaycaster();
  const transformConstraint = new TransformConstraint();
  const transformExecutor = new TransformExecutor(gridSnap);
  const commandStack = new CommandStack(DEFAULT_COMMAND_STACK_MAX_SIZE);
  return {
    gridSnap,
    snapManager: new ManagerSnap(DEFAULT_GRID_SNAP_INTERVAL),
    transformConstraint,
    transformExecutor,
    transformGizmo,
    gizmoRaycaster,
    commandStack,
    transformHandler: new HandlerTransform(
      transformGizmo,
      gizmoRaycaster,
      transformExecutor,
      transformConstraint,
      commandStack,
    ),
    componentTransformHandler: new HandlerComponentTransform(gridSnap, commandStack),
  };
}
