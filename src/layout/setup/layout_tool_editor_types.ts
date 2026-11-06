import type * as THREE from 'three';
import type { TransformMode } from '@/types/transform_mode.js';
import type { HandlerTransform } from '@/transform/core/handler_transform.js';
import type { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { ManagerInput } from '@/input/manager_input.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { EditorWindow } from '@/editor/window/editor_window.js';
import type { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import type { Viewport2D } from '@/viewports/core/viewport_2d.js';
import type { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import type { ClipTool } from '@/editor/tools/clip_tool.js';
import type { BridgeTransformInteraction } from '@/tools/bridge/bridge_transform_interaction.js';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import type { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import type { HandlerComponentTransform } from '@/edit/transform/handler_component_transform.js';
import type { ObjectSelectDoubleClickProperties } from '@/tools/object_select/object_select_double_click_properties.js';
import type { LayoutObjectDragHost } from './layout_object_drag_setup.js';

/** Dependencies for building the Shape Editor-style tool stack. */
export interface LayoutToolEditorSetupDeps {
  transformHandler: HandlerTransform;
  componentTransformHandler: HandlerComponentTransform;
  transformGizmo: GizmoTransform;
  selectionManager: ManagerSelection;
  inputManager: ManagerInput;
  /** Live grid snap used by transform math (Shift precision mode mutates this). */
  gridSnap: GridSnap;
  /**
   * Returns the user's snap preference independent of temporary Shift
   * precision.
   *
   * @returns True when the user wants snap enabled.
   */
  getUserSnapEnabled: () => boolean;
  getActiveViewport: () => Viewport3D | Viewport2D | null;
  /**
   * All interactive panes (2D + 3D, including detached). Used so tools can
   * resolve camera/pick from the pane under the pointer.
   */
  getInteractiveViewports: () => ReadonlyArray<Viewport3D | Viewport2D>;
  getTransformPivot: () => THREE.Vector3;
  setStatusMessage: (message: string) => void;
  refreshGizmoPresentation: () => void;
  onAfterTransformCommit: (objects: THREE.Object3D[]) => void;
  onTransformsLive?: (meshes: THREE.Mesh[]) => void;
  onRulerTransformFeedback?: (meshes: THREE.Mesh[], phase: 'begin' | 'move' | 'end') => void;
  /**
   * Keeps selection outlines and gizmo glued during live single-use moves (same
   * contract as gizmo pointer-move).
   *
   * @param transformTargets Objects receiving pose edits.
   * @param selectedMeshes Current selection meshes (solid live CSG keys off
   *   these).
   */
  onLiveTransformOverlaySync?: (
    transformTargets: readonly THREE.Object3D[],
    selectedMeshes: readonly THREE.Mesh[],
  ) => void;
  /**
   * Editor-global shortcut fallthrough (undo, file, tool SwitchTool map).
   *
   * @param event Browser keyboard event.
   * @returns True when handled.
   */
  handleGlobalKeyDown?: (event: KeyboardEvent) => boolean;
  /**
   * Returns whether camera navigation must suppress tool activation keys.
   *
   * @returns True while fly/pan owns continuous motion keys.
   */
  isNavigationBlockingTools?: () => boolean;
  /**
   * Returns the last pointer client position for a detached (or other)
   * document. Main-document samples use {@link inputManager} instead.
   *
   * @param ownerDocument Document that owns the pointer sample.
   * @returns Client coordinates, or null when unknown.
   */
  getLastPointerClientPositionForDocument?: (ownerDocument: Document) => { clientX: number; clientY: number } | null;
  /**
   * Returns input managers for open detached popups so Shift/Ctrl multi-select
   * sees keys held in those windows (main uses {@link inputManager}).
   *
   * @returns Detached popup input managers.
   */
  getDetachedInputManagers?: () => readonly ManagerInput[];
  /**
   * Permanent gizmo interaction bridge (widget-driven; no viewport callbacks).
   *
   * @returns Bridge instance when the transform system exists.
   */
  getTransformInteractionBridge?: () => BridgeTransformInteraction | null;
  /**
   * Face mode coordinator for FaceSelectTool mouse routing.
   *
   * @returns Coordinator when face mode is set up.
   */
  getFaceModeCoordinator?: () => CoordinatorFaceMode | null;
  /**
   * Edit Mode coordinator for EditSelectTool mouse routing.
   *
   * @returns Coordinator when edit mode is set up.
   */
  getEditModeCoordinator?: () => CoordinatorEditMode | null;
  /**
   * Grid orientation handler for GridTool face-align picks.
   *
   * @returns Handler when grid tools are set up.
   */
  getGridOrientationHandler?: () => import('@/tools/grid/handler_grid_orientation.js').HandlerGridOrientation | null;
  /**
   * Called when a permanent gizmo handle drag begins so widgets latch
   * wantsActive.
   */
  onPermanentGizmoHandleDragBegan?: () => void;
  /**
   * Called when a permanent gizmo handle drag ends so widgets clear
   * wantsActive.
   */
  onPermanentGizmoHandleDragEnded?: () => void;
  /**
   * Layout systems for moving the selection and drawing brushes with the mouse;
   * object dragging is off when omitted.
   */
  objectDragHost?: LayoutObjectDragHost;
  /** Opens Object Properties on object double-clicks; off when omitted. */
  objectSelectDoubleClick?: ObjectSelectDoubleClickProperties;
}

/** Built tool system exposed to the layout for keyboard and mode switches. */
export interface LayoutToolEditorSystem {
  editorWindow: EditorWindow;
  inputBridge: EditorInputBridge;
  /**
   * Toolbar / permanent mode switch (Shape Editor SwitchTool).
   *
   * @param mode Transform mode.
   * @returns True when the permanent tool is active.
   */
  switchToTransformMode: (mode: TransformMode) => boolean;
  /**
   * Returns to the default object-select tool.
   *
   * @returns True when object-select is active.
   */
  switchToObjectSelect: () => boolean;
  /**
   * Switches to the face select tool.
   *
   * @returns True when face-select is active.
   */
  switchToFaceSelect: () => boolean;
  /**
   * Switches to the Edit Mode select tool.
   *
   * @returns True when edit-select is active.
   */
  switchToEditSelect: () => boolean;
  /**
   * Switches to the grid orientation tool.
   *
   * @returns True when grid tool is active.
   */
  switchToGridTool: () => boolean;
  /** Re-pins exclusive routing roots to every interactive pane content element. */
  refreshInteractiveViewportDomain: () => void;
  /**
   * Cancels an active single-use tool if one is running.
   *
   * @returns True when a single-use tool was cancelled.
   */
  cancelActiveSingleUseTool: () => boolean;
  /**
   * Returns whether the active tool is busy (exclusive input).
   *
   * @returns True while a tool must keep focus.
   */
  isToolBusy: () => boolean;
  /**
   * Returns whether the focused event receiver is busy (Shape Editor
   * exclusive).
   *
   * @returns True while focus cannot leave the current receiver.
   */
  isActiveEventReceiverBusy: () => boolean;
  /**
   * Registers a floating tool window with the focus system.
   *
   * @param rootElement Panel root element.
   * @param surfaceId Stable surface id.
   */
  registerGuiSurface: (rootElement: HTMLElement, surfaceId: string) => void;
  /**
   * Unregisters a floating tool window from the focus system.
   *
   * @param rootElement Panel root element.
   */
  unregisterGuiSurface: (rootElement: HTMLElement) => void;
  /**
   * Installs capture-phase focus pointer routing on the editor host.
   *
   * @param hostElement Element that contains floating panels.
   */
  installFocusPointerRouter: (hostElement: HTMLElement) => void;
  /** Removes the capture-phase focus pointer router. */
  uninstallFocusPointerRouter: () => void;
  /**
   * Shape Editor OnKeyDown entry for the keyboard shortcut handler.
   *
   * @param event Browser keyboard event.
   * @returns True when consumed.
   */
  handleKeyDown: (event: KeyboardEvent) => boolean;
  /**
   * Sets the global keydown fallthrough (after tools).
   *
   * @param handler Global shortcut handler.
   */
  setGlobalKeyDownHandler: (handler: (event: KeyboardEvent) => boolean) => void;
  /**
   * Sets whether camera navigation suppresses tool keys.
   *
   * @param callback Returns true while navigation blocks tools.
   */
  setNavigationBlocksActions: (callback: () => boolean) => void;
  /**
   * Registers the clip plane tool with the editor window after the handler
   * exists.
   *
   * @param placement Clip placement model.
   * @param handler Clip interaction handler.
   * @returns Registered clip tool.
   */
  registerClipTool: (placement: ToolClipPlane, handler: HandlerClipPlane) => ClipTool;
  /**
   * Switches to the clip plane tool.
   *
   * @returns True when the clip tool is active.
   */
  switchToClipTool: () => boolean;
  /**
   * Returns whether the clip tool is the active editor tool.
   *
   * @returns True while clipping.
   */
  isClipToolActive: () => boolean;
}
