import { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { TransformMode } from '@/types/transform_mode.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';
import type { ObjectApplyTransformKind } from '@/types/object_apply_transform_kind.js';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';
import type { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import type { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import type { ViewportToolChromeDocking } from '@/tools/chrome/host/viewport_tool_chrome_docking.js';
import * as THREE from 'three';

/** Dependencies for per-viewport tool chrome and clip plane wiring. */
export interface ClipToolsSetupDeps {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  gridSnap: GridSnap;
  clipPlaneTool: ToolClipPlane;
  faceExtrusionController: ControllerFaceExtrusion;
  /** Parents of the main window's docked tool buttons and tool options. */
  toolChromeDocking: ViewportToolChromeDocking;
  /**
   * Viewports that show their own floating tool chrome, such as detached
   * windows.
   */
  getFloatingChromeViewports: () => readonly ViewportEditor[];
  keyboardShortcutHandler: HandlerKeyboardShortcut;
  showStatusMessage: (message: string) => void;
  syncPrimitivesToViewports: () => void;
  refreshOutliner: () => void;
  updateShadingMeshes: () => void;
  onToolStateChanged: () => void;
  onClipCancel: () => void;
  onTransformMode: (mode: TransformMode) => void;
  faceInspectorReveal: () => void;
  onExtrudeFaces: () => void;
  editorOverlayPolicy: PolicyEditorOverlay;
  modalToolSessionRegistry: RegistryModalToolSession;
  isEditorToolBusy?: () => boolean;
  switchToClipTool?: () => boolean;
  switchToObjectSelect?: () => void;
  switchToFaceSelect?: () => void;
  switchToEditSelect?: () => void;
  switchToGridTool?: () => void;
  onGridReset?: () => void;
  onGridAlignToFace?: () => void;
  onGridAlignAxis?: (
    axis: import('@/navigation/orientation/editor_orientation_axis.js').EditorOrientationAxisId,
  ) => void;
  onGridOriginVertex?: () => void;
  onCameraReset?: () => void;
  onCameraAlignToFace?: () => void;
  onPrimaryToolChanged?: () => void;
  registerClipTool?: (placement: ToolClipPlane, handler: HandlerClipPlane) => void;
  onEnterEditMode?: () => boolean;
  onExitEditMode?: () => void;
  onComponentMode?: (mode: EditorComponentMode) => void;
  onEditModePresentationChanged?: () => void;
  onApplyObjectTransform?: (kind: ObjectApplyTransformKind) => void;
  onConvexHull?: () => void;
  onEditKnife?: () => void;
  onEditLoopCut?: () => void;
  onEditMerge?: (mode: import('@/edit/topology/topology_vertex_merge_mode.js').TopologyVertexMergeMode) => void;
  onEditDissolve?: () => void;
  onEditDelete?: () => void;
}

/** Result of tool chrome controller and clip plane construction. */
export interface ClipToolsSetupResult {
  toolsPaletteController: ControllerViewportToolChrome;
  clipPlaneHandler: HandlerClipPlane;
}

/**
 * Creates the docked main window tool chrome, the floating tool chrome of
 * detached viewports, the clip plane handler and interaction-mode keyboard
 * wiring.
 *
 * @param deps Shared services and viewports for clip/tools setup.
 * @returns Created controller and clip handler.
 */
export function setupClipToolsAndPalette(deps: ClipToolsSetupDeps): ClipToolsSetupResult {
  const clipPlaneHandler = createClipPlaneHandler(deps);
  const toolsPaletteController = createViewportToolChromeController(deps, clipPlaneHandler);
  wireClipPlaneKeyboardShortcuts(deps, clipPlaneHandler);
  toolsPaletteController.dockedChromeAttach(deps.toolChromeDocking);
  syncToolChromeToViewports(toolsPaletteController, deps.getFloatingChromeViewports);
  return { toolsPaletteController, clipPlaneHandler };
}

/**
 * Attaches floating tool chrome to the pane container of every given viewport
 * and removes it from panes no longer listed.
 *
 * @param controller Tool chrome controller.
 * @param getViewports Provider of the viewports that show floating chrome.
 */
export function syncToolChromeToViewports(
  controller: ControllerViewportToolChrome,
  getViewports: () => readonly ViewportEditor[],
): void {
  const containers = getViewports().map((viewport) => viewport.getContainer());
  controller.syncPaneContainers(containers);
}

/**
 * Builds the clip plane handler with scene mutation callbacks.
 *
 * @param deps Clip/tools setup dependencies.
 * @returns Configured clip plane handler.
 */
function createClipPlaneHandler(deps: ClipToolsSetupDeps): HandlerClipPlane {
  const handler = new HandlerClipPlane({
    worldObject: deps.worldObject,
    commandStack: deps.commandStack,
    selectionManager: deps.selectionManager,
    gridSnap: deps.gridSnap,
    clipPlaneTool: deps.clipPlaneTool,
    modalToolSessionRegistry: deps.modalToolSessionRegistry,
    showStatusMessage: deps.showStatusMessage,
    syncPrimitivesToViewports: deps.syncPrimitivesToViewports,
    refreshOutliner: deps.refreshOutliner,
    updateShadingMeshes: deps.updateShadingMeshes,
    onToolStateChanged: deps.onToolStateChanged,
  });
  deps.registerClipTool?.(deps.clipPlaneTool, handler);
  return handler;
}

/**
 * Creates the viewport tool chrome controller.
 *
 * @param deps Clip/tools setup dependencies.
 * @param clipPlaneHandler Clip plane handler.
 * @returns Configured controller.
 */
function createViewportToolChromeController(
  deps: ClipToolsSetupDeps,
  clipPlaneHandler: HandlerClipPlane,
): ControllerViewportToolChrome {
  const controller = new ControllerViewportToolChrome({
    faceExtrusionController: deps.faceExtrusionController,
    clipPlaneTool: deps.clipPlaneTool,
    clipPlaneHandler,
    selectionManager: deps.selectionManager,
    editorOverlayPolicy: deps.editorOverlayPolicy,
    modalToolSessionRegistry: deps.modalToolSessionRegistry,
    showStatusMessage: deps.showStatusMessage,
    onTransformMode: (mode) => deps.onTransformMode(mode),
    faceInspectorReveal: () => deps.faceInspectorReveal(),
    onExtrudeFaces: () => deps.onExtrudeFaces(),
    ...(deps.isEditorToolBusy !== undefined ? { isEditorToolBusy: deps.isEditorToolBusy } : {}),
    ...(deps.switchToClipTool !== undefined ? { switchToClipTool: deps.switchToClipTool } : {}),
    ...(deps.switchToObjectSelect !== undefined ? { switchToObjectSelect: deps.switchToObjectSelect } : {}),
    ...(deps.switchToFaceSelect !== undefined ? { switchToFaceSelect: deps.switchToFaceSelect } : {}),
    ...(deps.switchToEditSelect !== undefined ? { switchToEditSelect: deps.switchToEditSelect } : {}),
    ...(deps.switchToGridTool !== undefined ? { switchToGridTool: deps.switchToGridTool } : {}),
    ...(deps.onGridReset !== undefined ? { onGridReset: deps.onGridReset } : {}),
    ...(deps.onGridAlignToFace !== undefined ? { onGridAlignToFace: deps.onGridAlignToFace } : {}),
    ...(deps.onGridAlignAxis !== undefined ? { onGridAlignAxis: deps.onGridAlignAxis } : {}),
    ...(deps.onGridOriginVertex !== undefined ? { onGridOriginVertex: deps.onGridOriginVertex } : {}),
    ...(deps.onCameraReset !== undefined ? { onCameraReset: deps.onCameraReset } : {}),
    ...(deps.onCameraAlignToFace !== undefined ? { onCameraAlignToFace: deps.onCameraAlignToFace } : {}),
    ...(deps.onPrimaryToolChanged !== undefined ? { onPrimaryToolChanged: deps.onPrimaryToolChanged } : {}),
    ...(deps.onEnterEditMode !== undefined ? { onEnterEditMode: deps.onEnterEditMode } : {}),
    ...(deps.onExitEditMode !== undefined ? { onExitEditMode: deps.onExitEditMode } : {}),
    ...(deps.onComponentMode !== undefined ? { onComponentMode: deps.onComponentMode } : {}),
    ...(deps.onEditModePresentationChanged !== undefined
      ? { onEditModePresentationChanged: deps.onEditModePresentationChanged }
      : {}),
    ...(deps.onApplyObjectTransform !== undefined ? { onApplyObjectTransform: deps.onApplyObjectTransform } : {}),
    ...(deps.onConvexHull !== undefined ? { onConvexHull: deps.onConvexHull } : {}),
    ...(deps.onEditKnife !== undefined ? { onEditKnife: deps.onEditKnife } : {}),
    ...(deps.onEditLoopCut !== undefined ? { onEditLoopCut: deps.onEditLoopCut } : {}),
    ...(deps.onEditMerge !== undefined ? { onEditMerge: deps.onEditMerge } : {}),
    ...(deps.onEditDissolve !== undefined ? { onEditDissolve: deps.onEditDissolve } : {}),
    ...(deps.onEditDelete !== undefined ? { onEditDelete: deps.onEditDelete } : {}),
  });
  deps.keyboardShortcutHandler.setOnInteractionModeToggle(() => {
    controller.toggleInteractionMode();
  });
  return controller;
}

/**
 * Wires keyboard shortcuts used while the clip plane tool is active.
 *
 * @param deps Clip/tools setup dependencies.
 * @param clipPlaneHandler Clip plane handler for flip/commit actions.
 */
function wireClipPlaneKeyboardShortcuts(deps: ClipToolsSetupDeps, clipPlaneHandler: HandlerClipPlane): void {
  deps.keyboardShortcutHandler.setClipPlaneShortcuts(
    () => deps.clipPlaneTool.isActive(),
    () => clipPlaneHandler.flipPlane(),
    () => clipPlaneHandler.commitClip(),
    () => clipPlaneHandler.commitSplit(),
    () => deps.onClipCancel(),
  );
}

/**
 * Cancels the clip tool and returns tool chrome to object select.
 *
 * @param clipPlaneHandler Active clip plane handler, if any.
 * @param toolsPaletteController Tool chrome controller, if any.
 */
export function cancelClipAndSelectObject(
  clipPlaneHandler: HandlerClipPlane | null,
  toolsPaletteController: ControllerViewportToolChrome | null,
): void {
  clipPlaneHandler?.cancel();
  toolsPaletteController?.selectTool(EditorToolId.OBJECT);
}
