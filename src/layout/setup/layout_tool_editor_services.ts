import type * as THREE from 'three';
import type { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import type { ISelectable } from '@/editor/i_selectable.js';
import type { DomModifierKeyFlags } from '@/input/modifier_keys_query.js';
import type { ObjectDragController } from '@/tools/object_drag/object_drag_controller.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import { entityTransformScaleAllowedAll } from '@/entity/scale/entity_scale_allowed.js';
import { layoutToolEditorFaceServicesCreate } from './layout_tool_editor_face_services.js';
import {
  layoutToolEditorAltPressedResolve,
  layoutToolEditorAnyModifierPressedResolve,
  layoutToolEditorCtrlPressedResolve,
  layoutToolEditorShiftPressedResolve,
} from './layout_tool_editor_modifier_keys.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_types.js';
import {
  applyObjectClickSelectionAtClientPoint,
  applySingleUsePointerMove,
  beginSingleUseDragHiddenGizmo,
  collectInteractivePickElements,
  createComponentTransformBridge,
  handleModalKeyDownWithLiveVisuals,
  pickObjectStackAtClientPoint,
  resolveAverageScreenPosition,
  resolveEditorSelectedCount,
  resolveEditorTransformPivot,
  resolveFirstInteractiveViewportInDocument,
  resolveInteractiveViewportAtClientPoint,
  resolveLastPointerClientPosition,
  restoreSingleUseSnapUserPreference,
  snapEditLoopCutParameterWithShift,
  snapEditWorldPointWithShift,
  syncSingleUseSnapFromShift,
  tryBeginComponentSingleUseDrag,
  iterateSelectables,
} from './layout_tool_editor_helpers.js';

/**
 * Builds map-editor services for EditorWindow tools and widgets.
 *
 * @param deps Layout services.
 * @param getGlobalKeyDown Global keydown fallthrough getter.
 * @param getNavigationBlocks Navigation block getter.
 * @param inputBridge Input bridge for exclusive viewport root.
 * @param getPointerOwnerDocument Document that owns the last pointer sample.
 * @param getLatchedModifierFlags Bridge-latched DOM modifiers from the last
 *   sample.
 * @param objectDragController Object drag controller, or null when object
 *   dragging is off.
 * @returns Services implementation.
 */
export function createEditorServices(
  deps: LayoutToolEditorSetupDeps,
  getGlobalKeyDown: () => ((event: KeyboardEvent) => boolean) | null,
  getNavigationBlocks: () => (() => boolean) | null,
  inputBridge: EditorInputBridge,
  getPointerOwnerDocument: () => Document | null,
  getLatchedModifierFlags: () => DomModifierKeyFlags | null,
  objectDragController: ObjectDragController | null,
): EditorServices {
  const selectableCache = new Map<THREE.Object3D, ISelectable>();
  const componentTransformBridge = createComponentTransformBridge(deps, getPointerOwnerDocument);
  return {
    getTransformTargets: () => {
      const selected = filterUnlockedObjects(deps.selectionManager.getAllSelectedObjectsAsArray());
      return resolveTransformTargets(selected, deps.selectionManager.getInspectorObjects());
    },
    forEachSelectedObject: () =>
      iterateSelectables(filterUnlockedObjects(deps.selectionManager.getAllSelectedObjectsAsArray()), selectableCache),
    getSelectedCount: () => resolveEditorSelectedCount(deps),
    getTransformPivot: () => resolveEditorTransformPivot(deps),
    getSelectedSegmentsAveragePosition: () => resolveAverageScreenPosition(deps),
    isSnapping: () => false,
    getGridSnap: () => 1,
    getAngleSnap: () => 15,
    screenPointToGrid: (screenX, screenY) => ({ x: screenX, y: screenY }),
    gridPointToScreen: (gridX, gridY) => ({ x: gridX, y: gridY }),
    getActiveCamera: () => deps.getActiveViewport()?.getCamera() ?? null,
    getActivePickElement: () => deps.getActiveViewport()?.getContentElement() ?? null,
    resolveInteractiveViewportAtClientPoint: (clientX, clientY, ownerDocument) =>
      resolveInteractiveViewportAtClientPoint(deps, clientX, clientY, ownerDocument),
    resolveFirstInteractiveViewportInDocument: (ownerDocument) =>
      resolveFirstInteractiveViewportInDocument(deps, ownerDocument),
    getInteractiveViewportPickElements: () => collectInteractivePickElements(deps),
    beginSingleUseDrag: (mode, objects, pivot, camera, pickElement, clientX, clientY) => {
      if (tryBeginComponentSingleUseDrag(deps, mode, camera, pickElement, clientX, clientY)) {
        deps.transformGizmo.setVisible(false);
        inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
        return true;
      }
      return beginSingleUseDragHiddenGizmo(
        deps,
        inputBridge,
        mode,
        objects,
        pivot,
        camera,
        pickElement,
        clientX,
        clientY,
      );
    },
    applySingleUsePointerMove: (clientX, clientY, camera, pickElement) => {
      if (deps.componentTransformHandler.isDragging()) {
        syncSingleUseSnapFromShift(deps);
        deps.componentTransformHandler.applyPointerMove(clientX, clientY);
        deps.getEditModeCoordinator?.()?.refreshPresentation();
        return;
      }
      applySingleUsePointerMove(deps, clientX, clientY, camera, pickElement);
    },
    isTransformDragActive: () => deps.transformHandler.isDragging() || deps.componentTransformHandler.isDragging(),
    isPermanentGizmoHandleDragActive: () =>
      (deps.transformHandler.isDragging() && !deps.transformHandler.isSingleUseDrag()) ||
      deps.componentTransformHandler.isPermanentDrag() ||
      componentTransformBridge.isPermanentDragActive(),
    handleModalKeyDown: (_keyCode, event) => handleModalKeyDownWithLiveVisuals(deps, event),
    commitActiveTransformDrag: () => {
      if (deps.componentTransformHandler.isDragging()) {
        deps.componentTransformHandler.commitIfNeeded();
        restoreSingleUseSnapUserPreference(deps);
        inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
        deps.refreshGizmoPresentation();
        return;
      }
      deps.transformHandler.commitActiveDragIfNeeded();
      restoreSingleUseSnapUserPreference(deps);
      inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
      deps.refreshGizmoPresentation();
    },
    cancelActiveTransformDrag: () => {
      if (deps.componentTransformHandler.isDragging()) {
        deps.componentTransformHandler.cancelIfNeeded();
        restoreSingleUseSnapUserPreference(deps);
        inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
        deps.refreshGizmoPresentation();
        return;
      }
      deps.transformHandler.cancelActiveDragIfNeeded();
      restoreSingleUseSnapUserPreference(deps);
      inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
      deps.refreshGizmoPresentation();
    },
    pinExclusiveViewportDomain: (pickElements) => {
      inputBridge.setExclusiveViewportRoots(pickElements);
    },
    pinExclusiveViewport: (pickElement) => {
      if (pickElement === undefined || pickElement === null) {
        inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
        return;
      }
      inputBridge.setExclusiveViewportRoot(pickElement);
    },
    clearExclusiveViewport: () => {
      inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
    },
    pickObjectStackAtClientPoint: (clientX, clientY) =>
      pickObjectStackAtClientPoint(deps, clientX, clientY, null, getPointerOwnerDocument()),
    clearObjectSelection: () => {
      if (deps.getEditModeCoordinator?.()?.isActive() === true) {
        return;
      }
      deps.selectionManager.clearSelection();
    },
    applyObjectClickSelectionAtClientPoint: (clientX, clientY, additive, toggle) => {
      if (deps.getEditModeCoordinator?.()?.isActive() === true) {
        return;
      }
      applyObjectClickSelectionAtClientPoint(deps, clientX, clientY, additive, toggle, getPointerOwnerDocument());
    },
    objectClickReleaseDoubleClickHandle: (clientX, clientY, isModifierHeld) =>
      deps.objectSelectDoubleClick?.clickRelease(clientX, clientY, isModifierHeld) === true,
    objectShiftClickFaceEditApply: (clientX, clientY) =>
      deps.objectShiftClickFaceEdit?.clickApply(clientX, clientY) === true,
    isSelectionScaleAllowed: () => entityTransformScaleAllowedAll(deps.selectionManager.getAllSelectedObjectsAsArray()),
    beginObjectDragAtClientPoint: (press) => objectDragController?.dragBegin(press) ?? null,
    tryBeginPermanentGizmoDragFromEditorPointer: (clientX, clientY, modifiers) => {
      if (deps.getEditModeCoordinator?.()?.isActive() === true) {
        return componentTransformBridge.tryBeginFromEditorPointer(clientX, clientY, modifiers);
      }
      const bridge = deps.getTransformInteractionBridge?.() ?? null;
      if (!bridge) {
        return false;
      }
      return bridge.tryBeginFromEditorPointer(clientX, clientY, modifiers);
    },
    probePermanentGizmoUnderPointer: (clientX, clientY, modifiers) => {
      if (deps.getEditModeCoordinator?.()?.isActive() === true) {
        return componentTransformBridge.probeGizmoUnderPointer(clientX, clientY, modifiers);
      }
      const bridge = deps.getTransformInteractionBridge?.() ?? null;
      if (!bridge) {
        return false;
      }
      return bridge.probeGizmoUnderPointer(clientX, clientY, modifiers);
    },
    updateBoundsHoverAtClientPoint: (clientX, clientY) => {
      const bridge = deps.getTransformInteractionBridge?.() ?? null;
      if (!bridge) {
        return;
      }
      if (deps.getEditModeCoordinator?.()?.isActive() === true) {
        bridge.clearBoundsHover();
        return;
      }
      bridge.updateBoundsHoverAtClientPoint(clientX, clientY);
    },
    clearBoundsHoverAtClientPoint: () => {
      const bridge = deps.getTransformInteractionBridge?.() ?? null;
      if (!bridge) {
        return;
      }
      bridge.clearBoundsHover();
    },
    ...layoutToolEditorFaceServicesCreate(() => deps.getFaceModeCoordinator?.() ?? null, getPointerOwnerDocument),
    isGridAlignPickArmed: () => {
      return deps.getGridOrientationHandler?.()?.isAlignPickArmed() === true;
    },
    disarmGridAlignPick: () => {
      deps.getGridOrientationHandler?.()?.disarmAlignPick();
    },
    tryGridAlignPickAtPointer: (clientX, clientY) => {
      return (
        deps.getGridOrientationHandler?.()?.tryAlignPickAtClientPoint(clientX, clientY, getPointerOwnerDocument()) ===
        true
      );
    },
    updateGridAlignHoverAtPointer: (clientX, clientY) => {
      deps.getGridOrientationHandler?.()?.updateHoverAtClientPoint(clientX, clientY, getPointerOwnerDocument());
    },
    isEditModeActive: () => deps.getEditModeCoordinator?.()?.isActive() === true,
    pickEditEdgeParameter: (clientX, clientY, ownerDocument) => {
      return (
        deps.getEditModeCoordinator?.()?.pickEdgeParameterAtClient(clientX, clientY, ownerDocument ?? null) ?? null
      );
    },
    splitEditEdge: (targetId, vertexA, vertexB, parameter) => {
      return deps.getEditModeCoordinator?.()?.splitEdge(targetId, vertexA, vertexB, parameter) === true;
    },
    loopCutEditEdge: (targetId, vertexA, vertexB, parameter, lockedEdges) => {
      return deps.getEditModeCoordinator?.()?.loopCut(targetId, vertexA, vertexB, parameter, lockedEdges) === true;
    },
    projectLockedLoopCutParameter: (clientX, clientY, worldA, worldB, ownerDocument) => {
      return (
        deps
          .getEditModeCoordinator?.()
          ?.projectLockedLoopCutParameter(clientX, clientY, worldA, worldB, ownerDocument ?? null) ?? null
      );
    },
    snapEditWorldPoint: (position, shiftHeld) => snapEditWorldPointWithShift(deps, position, shiftHeld),
    snapEditLoopCutParameter: (worldA, worldB, parameter, shiftHeld, range) =>
      snapEditLoopCutParameterWithShift(deps, worldA, worldB, parameter, shiftHeld, range),
    dissolveEditSelection: () => deps.getEditModeCoordinator?.()?.dissolveSelection() === true,
    deleteEditSelection: () => deps.getEditModeCoordinator?.()?.deleteSelection() === true,
    mergeEditSelection: (mode) => deps.getEditModeCoordinator?.()?.mergeSelection(mode) === true,
    getPrimaryScene: () => deps.getEditModeCoordinator?.()?.getOverlayScene() ?? null,
    getEditSession: () => {
      const coordinator = deps.getEditModeCoordinator?.();
      if (!coordinator || !coordinator.isActive()) {
        return null;
      }
      return coordinator.getSession();
    },
    beginEditSelectPointerDown: (clientX, clientY, isShiftPressed, isCtrlPressed, ownerDocument) => {
      return (
        deps
          .getEditModeCoordinator?.()
          ?.pickAtClientPoint(
            clientX,
            clientY,
            isShiftPressed,
            isCtrlPressed,
            ownerDocument ?? getPointerOwnerDocument(),
          ) === true
      );
    },
    setWidgetMode: (mode) => {
      deps.transformGizmo.setMode(mode);
    },
    getWidgetMode: () => deps.transformGizmo.getMode(),
    refreshGizmoPresentation: () => deps.refreshGizmoPresentation(),
    setStatusMessage: (message) => deps.setStatusMessage(message),
    registerUndo: (_name) => {},
    discardUndo: () => {},
    publishTransformDragVisualEnd: (objects, _reason) => {
      deps.onAfterTransformCommit([...objects]);
    },
    getLastPointerClientPosition: (ownerDocument) => resolveLastPointerClientPosition(deps, ownerDocument),
    isShiftPressed: () => layoutToolEditorShiftPressedResolve(deps, getLatchedModifierFlags),
    isCtrlPressed: () => layoutToolEditorCtrlPressedResolve(deps, getLatchedModifierFlags),
    isAltPressed: () => layoutToolEditorAltPressedResolve(deps, getLatchedModifierFlags),
    isModifierPressed: () => layoutToolEditorAnyModifierPressedResolve(deps, getLatchedModifierFlags),
    handleGlobalKeyDown: (_keyCode, event) => getGlobalKeyDown()?.(event) === true,
    isNavigationBlockingTools: () => getNavigationBlocks()?.() === true,
  };
}
