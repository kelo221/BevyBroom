import type { EditorOrientationAxisId } from '@/navigation/orientation/editor_orientation_axis.js';
import type { TopologyVertexMergeMode } from '@/edit/topology/topology_vertex_merge_mode.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import type { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { LayoutToolsPaletteClipHost } from './layout_tools_palette_clip_host.js';

/** Options passed to setupToolsPaletteAndClipWiring. */
export type LayoutToolsPaletteClipOptions = Parameters<
  typeof import('./layout_coordinator_setup.js').setupToolsPaletteAndClipWiring
>[0];

/** Core identity and chrome options. */
type LayoutToolsPaletteClipCoreIdentityOptions = Pick<
  LayoutToolsPaletteClipOptions,
  | 'worldObject'
  | 'commandStack'
  | 'selectionManager'
  | 'gridSnap'
  | 'clipPlaneTool'
  | 'faceModeCoordinator'
  | 'toolChromeDocking'
  | 'getFloatingChromeViewports'
  | 'keyboardShortcutHandler'
>;

/** Core status and clip-lifecycle options. */
type LayoutToolsPaletteClipCoreStatusOptions = Pick<
  LayoutToolsPaletteClipOptions,
  | 'showStatusMessage'
  | 'syncPrimitivesToViewports'
  | 'refreshOutliner'
  | 'updateShadingMeshes'
  | 'onToolStateChanged'
  | 'onClipCancel'
  | 'onTransformMode'
  | 'faceInspectorReveal'
  | 'editorOverlayPolicy'
  | 'modalToolSessionRegistry'
>;

/** Tool-switch and busy-state options. */
type LayoutToolsPaletteClipSwitchOptions = Pick<
  LayoutToolsPaletteClipOptions,
  | 'isEditorToolBusy'
  | 'switchToClipTool'
  | 'switchToObjectSelect'
  | 'switchToFaceSelect'
  | 'switchToEditSelect'
  | 'switchToGridTool'
  | 'switchToPolygonTool'
  | 'onPrimaryToolChanged'
  | 'registerClipTool'
>;

/** Grid and camera-align options. */
type LayoutToolsPaletteClipGridOptions = Pick<
  LayoutToolsPaletteClipOptions,
  | 'onGridReset'
  | 'onGridAlignToFace'
  | 'onGridAlignAxis'
  | 'onGridOriginVertex'
  | 'onCameraReset'
  | 'onCameraAlignToFace'
>;

/** Edit Mode session options. */
type LayoutToolsPaletteClipEditModeOptions = Pick<
  LayoutToolsPaletteClipOptions,
  'onEnterEditMode' | 'onExitEditMode' | 'onComponentMode' | 'onEditModePresentationChanged' | 'onApplyObjectTransform'
>;

/** Edit Mode tool-action options. */
type LayoutToolsPaletteClipEditToolOptions = Pick<
  LayoutToolsPaletteClipOptions,
  | 'onConvexHull'
  | 'onShapeSettingChanged'
  | 'onEditKnife'
  | 'onEditLoopCut'
  | 'onEditMerge'
  | 'onEditDissolve'
  | 'onEditDelete'
>;

/**
 * Builds the options object for createToolsPaletteAndClip.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Options for setupToolsPaletteAndClipWiring.
 */
export function layoutToolsPaletteClipOptionsCreate(host: LayoutToolsPaletteClipHost): LayoutToolsPaletteClipOptions {
  return {
    ...layoutToolsPaletteClipCoreIdentityOptionsCreate(host),
    ...layoutToolsPaletteClipCoreStatusOptionsCreate(host),
    ...layoutToolsPaletteClipSwitchOptionsCreate(host),
    ...layoutToolsPaletteClipGridOptionsCreate(host),
    ...layoutToolsPaletteClipEditModeOptionsCreate(host),
    ...layoutToolsPaletteClipEditToolOptionsCreate(host),
  };
}

/**
 * Builds core identity and chrome options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Identity options.
 */
function layoutToolsPaletteClipCoreIdentityOptionsCreate(
  host: LayoutToolsPaletteClipHost,
): LayoutToolsPaletteClipCoreIdentityOptions {
  return {
    worldObject: host.worldObject,
    commandStack: host.commandStack,
    selectionManager: host.selectionManager,
    gridSnap: host.gridSnap,
    clipPlaneTool: host.clipPlaneTool,
    faceModeCoordinator: host.faceModeCoordinator,
    toolChromeDocking: host.shellElements.toolChromeDocking,
    getFloatingChromeViewports: () => host.detachedViewportWindow.getViewports(),
    keyboardShortcutHandler: host.keyboardShortcutHandler,
  };
}

/**
 * Builds core status and clip-lifecycle options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Status options.
 */
function layoutToolsPaletteClipCoreStatusOptionsCreate(
  host: LayoutToolsPaletteClipHost,
): LayoutToolsPaletteClipCoreStatusOptions {
  return {
    showStatusMessage: (message) => host.showStatusMessage(message),
    syncPrimitivesToViewports: () => host.syncPrimitivesToViewports(),
    refreshOutliner: () => host.refreshOutliner(),
    updateShadingMeshes: () => host.shadingModeCoordinator.updateShadingMeshes(),
    onToolStateChanged: () => host.onClipToolStateChanged(),
    onClipCancel: () => host.onClipCancel(),
    onTransformMode: (mode) => host.onTransformMode(mode),
    faceInspectorReveal: () => host.faceInspectorReveal(),
    editorOverlayPolicy: host.editorOverlayPolicy,
    modalToolSessionRegistry: host.modalToolSessionRegistry,
  };
}

/**
 * Builds tool-switch and busy-state options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Switch options.
 */
function layoutToolsPaletteClipSwitchOptionsCreate(
  host: LayoutToolsPaletteClipHost,
): LayoutToolsPaletteClipSwitchOptions {
  return {
    isEditorToolBusy: () => host.toolEditorSystem?.isActiveEventReceiverBusy() === true,
    switchToClipTool: () => host.toolEditorSystem?.switchToClipTool() === true,
    switchToObjectSelect: () => host.toolEditorSystem?.switchToObjectSelect(),
    switchToFaceSelect: () => host.toolEditorSystem?.switchToFaceSelect(),
    switchToEditSelect: () => host.toolEditorSystem?.switchToEditSelect(),
    switchToGridTool: () => host.toolEditorSystem?.switchToGridTool(),
    switchToPolygonTool: (onLeft) => host.toolEditorSystem?.switchToPolygonTool(onLeft),
    onPrimaryToolChanged: () => layoutToolsPalettePrimaryToolChanged(host),
    registerClipTool: (placement, handler) => layoutToolsPaletteClipToolRegister(host, placement, handler),
  };
}

/**
 * Builds grid and camera-align options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Grid options.
 */
function layoutToolsPaletteClipGridOptionsCreate(host: LayoutToolsPaletteClipHost): LayoutToolsPaletteClipGridOptions {
  return {
    onGridReset: () => host.gridOrientationHandler?.resetOrientation(),
    onGridAlignToFace: () => layoutToolsPaletteGridAlignToFaceArm(host),
    onGridAlignAxis: (axis) => layoutToolsPaletteGridAlignAxisArm(host, axis),
    onGridOriginVertex: () => layoutToolsPaletteGridOriginVertexArm(host),
    onCameraReset: () => host.gridOrientationHandler?.resetCameraOrientation(),
    onCameraAlignToFace: () => layoutToolsPaletteCameraAlignToFaceArm(host),
  };
}

/**
 * Builds Edit Mode session options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Edit Mode session options.
 */
function layoutToolsPaletteClipEditModeOptionsCreate(
  host: LayoutToolsPaletteClipHost,
): LayoutToolsPaletteClipEditModeOptions {
  return {
    onEnterEditMode: () => host.editModeCoordinator?.enterFromObjectSelection() === true,
    onExitEditMode: () => host.editModeCoordinator?.exitToObjectMode(),
    onComponentMode: (mode) => host.editModeCoordinator?.setComponentMode(mode),
    onEditModePresentationChanged: () => layoutToolsPaletteEditModePresentationRefresh(host),
    onApplyObjectTransform: (kind) => host.applyObjectTransformsFromChrome(kind),
  };
}

/**
 * Builds Edit Mode tool-action options.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @returns Edit tool options.
 */
function layoutToolsPaletteClipEditToolOptionsCreate(
  host: LayoutToolsPaletteClipHost,
): LayoutToolsPaletteClipEditToolOptions {
  return {
    onConvexHull: () => host.hullBrushesFromChrome(),
    onShapeSettingChanged: () => host.shapeDrawSetup.shapeSettingChanged(),
    onEditKnife: () => host.toolEditorSystem?.editorWindow.useSingleUseEditKnifeTool(),
    onEditLoopCut: () => host.toolEditorSystem?.editorWindow.useSingleUseEditLoopCutTool(),
    onEditMerge: (mode) => layoutToolsPaletteEditMergeApply(host, mode),
    onEditDissolve: () => host.editModeCoordinator?.dissolveSelection(),
    onEditDelete: () => host.editModeCoordinator?.deleteSelection(),
  };
}

/**
 * Updates gizmos after the primary tool changes.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPalettePrimaryToolChanged(host: LayoutToolsPaletteClipHost): void {
  host.updateGizmoVisibility();
  host.updateGizmoPivot();
}

/**
 * Registers the clip plane tool with the editor window.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @param placement Clip placement model.
 * @param handler Clip interaction handler.
 */
function layoutToolsPaletteClipToolRegister(
  host: LayoutToolsPaletteClipHost,
  placement: ToolClipPlane,
  handler: HandlerClipPlane,
): void {
  host.toolEditorSystem?.registerClipTool(placement, handler);
}

/**
 * Switches to the grid tool and pins exclusive viewport routing.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteGridToolExclusiveViewportArm(host: LayoutToolsPaletteClipHost): void {
  host.toolEditorSystem?.switchToGridTool();
  host.toolEditorSystem?.editorWindow.getServices()?.pinExclusiveViewport();
}

/**
 * Switches to the grid tool and arms face-align pick.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteGridAlignToFaceArm(host: LayoutToolsPaletteClipHost): void {
  layoutToolsPaletteGridToolExclusiveViewportArm(host);
  host.gridOrientationHandler?.armAlignPick();
}

/**
 * Switches to the grid tool and arms edge-align pick for one axis.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @param axis Working-frame axis id.
 */
function layoutToolsPaletteGridAlignAxisArm(host: LayoutToolsPaletteClipHost, axis: EditorOrientationAxisId): void {
  layoutToolsPaletteGridToolExclusiveViewportArm(host);
  host.gridOrientationHandler?.armEdgeAlignPick(axis);
}

/**
 * Switches to the grid tool and arms origin-vertex pick.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteGridOriginVertexArm(host: LayoutToolsPaletteClipHost): void {
  layoutToolsPaletteGridToolExclusiveViewportArm(host);
  host.gridOrientationHandler?.armOriginVertexPick();
}

/**
 * Switches to the grid tool and arms camera face-align pick.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteCameraAlignToFaceArm(host: LayoutToolsPaletteClipHost): void {
  layoutToolsPaletteGridToolExclusiveViewportArm(host);
  host.gridOrientationHandler?.armCameraAlignPick();
}

/**
 * Refreshes gizmos, rulers, and object chrome after Edit Mode presentation
 * changes.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteEditModePresentationRefresh(host: LayoutToolsPaletteClipHost): void {
  if (host.isEditModeActive()) {
    layoutToolsPaletteEditModePresentationSuppress(host);
  }
  host.updateGizmoVisibility();
  host.updateTransformButtons();
  host.refreshCadRulersFromSelection();
  host.selectionVisualController?.setObjectSelectionChromeEnabled(!host.isEditModeActive());
}

/**
 * Applies Edit Mode default widgets and suppresses object-mode hover chrome.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 */
function layoutToolsPaletteEditModePresentationSuppress(host: LayoutToolsPaletteClipHost): void {
  host.applyEditModeDefaultNoTransformWidget();
  host.editModeCoordinator?.suppressObjectModeWireframes();
  host.transformInteractionBridge?.clearBoundsHover();
  host.transformHandler?.clearBoundsHover();
}

/**
 * Merges the current Edit Mode vertex selection.
 *
 * @param host Layout callbacks used by tool chrome and clip wiring.
 * @param mode Vertex merge mode.
 */
function layoutToolsPaletteEditMergeApply(host: LayoutToolsPaletteClipHost, mode: TopologyVertexMergeMode): void {
  host.editModeCoordinator?.mergeSelection(mode);
}
