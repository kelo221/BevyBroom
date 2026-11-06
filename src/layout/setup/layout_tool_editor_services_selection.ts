import type { EditorServices } from '@/editor/window/editor_services.js';
import { entityTransformScaleAllowedAll } from '@/entity/scale/entity_scale_allowed.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import {
  applyObjectClickSelectionAtClientPoint,
  iterateSelectables,
  pickObjectStackAtClientPoint,
  resolveAverageScreenPosition,
  resolveEditorSelectedCount,
  resolveEditorTransformPivot,
} from './layout_tool_editor_helpers.js';
import {
  layoutToolEditorEditModeActiveRead,
  type LayoutToolEditorServicesContext,
} from './layout_tool_editor_services_context.js';

/** Selection and object-drag EditorServices. */
export type LayoutToolEditorSelectionServices = Pick<
  EditorServices,
  | 'getTransformTargets'
  | 'forEachSelectedObject'
  | 'getSelectedCount'
  | 'getTransformPivot'
  | 'getSelectedSegmentsAveragePosition'
  | 'isSnapping'
  | 'getGridSnap'
  | 'getAngleSnap'
  | 'screenPointToGrid'
  | 'gridPointToScreen'
  | 'pickObjectStackAtClientPoint'
  | 'clearObjectSelection'
  | 'applyObjectClickSelectionAtClientPoint'
  | 'objectClickReleaseDoubleClickHandle'
  | 'objectShiftClickFaceEditApply'
  | 'isSelectionScaleAllowed'
  | 'beginObjectDragAtClientPoint'
>;

/** Transform target and pivot EditorServices. */
type LayoutToolEditorSelectionTargetServices = Pick<
  EditorServices,
  | 'getTransformTargets'
  | 'forEachSelectedObject'
  | 'getSelectedCount'
  | 'getTransformPivot'
  | 'getSelectedSegmentsAveragePosition'
>;

/** Snap and screen-grid EditorServices. */
type LayoutToolEditorSelectionSnapServices = Pick<
  EditorServices,
  'isSnapping' | 'getGridSnap' | 'getAngleSnap' | 'screenPointToGrid' | 'gridPointToScreen'
>;

/** Object pick, click selection, and drag EditorServices. */
type LayoutToolEditorSelectionPickServices = Pick<
  EditorServices,
  | 'pickObjectStackAtClientPoint'
  | 'clearObjectSelection'
  | 'applyObjectClickSelectionAtClientPoint'
  | 'objectClickReleaseDoubleClickHandle'
  | 'objectShiftClickFaceEditApply'
  | 'isSelectionScaleAllowed'
  | 'beginObjectDragAtClientPoint'
>;

/**
 * Builds selection and object-drag editor services.
 *
 * @param ctx Shared editor services context.
 * @returns Selection services.
 */
export function layoutToolEditorSelectionServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorSelectionServices {
  return {
    ...layoutToolEditorSelectionTargetServicesCreate(ctx),
    ...layoutToolEditorSelectionSnapServicesCreate(),
    ...layoutToolEditorSelectionPickServicesCreate(ctx),
  };
}

/**
 * Builds transform target and pivot services.
 *
 * @param ctx Shared editor services context.
 * @returns Target services.
 */
function layoutToolEditorSelectionTargetServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorSelectionTargetServices {
  return {
    getTransformTargets: () => layoutToolEditorTransformTargetsResolve(ctx),
    forEachSelectedObject: () => layoutToolEditorSelectedObjectsIterate(ctx),
    getSelectedCount: () => resolveEditorSelectedCount(ctx.deps),
    getTransformPivot: () => resolveEditorTransformPivot(ctx.deps),
    getSelectedSegmentsAveragePosition: () => resolveAverageScreenPosition(ctx.deps),
  };
}

/**
 * Builds snap and screen-grid services.
 *
 * @returns Snap services.
 */
function layoutToolEditorSelectionSnapServicesCreate(): LayoutToolEditorSelectionSnapServices {
  return {
    isSnapping: () => false,
    getGridSnap: () => 1,
    getAngleSnap: () => 15,
    screenPointToGrid: (screenX, screenY) => ({ x: screenX, y: screenY }),
    gridPointToScreen: (gridX, gridY) => ({ x: gridX, y: gridY }),
  };
}

/**
 * Builds object pick, click selection, and drag services.
 *
 * @param ctx Shared editor services context.
 * @returns Pick services.
 */
function layoutToolEditorSelectionPickServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorSelectionPickServices {
  return {
    pickObjectStackAtClientPoint: (clientX, clientY) =>
      pickObjectStackAtClientPoint(ctx.deps, clientX, clientY, null, ctx.getPointerOwnerDocument()),
    clearObjectSelection: () => layoutToolEditorObjectSelectionClear(ctx),
    applyObjectClickSelectionAtClientPoint: (clientX, clientY, additive, toggle) =>
      layoutToolEditorObjectClickSelectionApply(ctx, clientX, clientY, additive, toggle),
    objectClickReleaseDoubleClickHandle: (clientX, clientY, isModifierHeld) =>
      ctx.deps.objectSelectDoubleClick?.clickRelease(clientX, clientY, isModifierHeld) === true,
    objectShiftClickFaceEditApply: (clientX, clientY) =>
      ctx.deps.objectShiftClickFaceEdit?.clickApply(clientX, clientY) === true,
    isSelectionScaleAllowed: () => layoutToolEditorSelectionScaleAllowedRead(ctx),
    beginObjectDragAtClientPoint: (press) => ctx.objectDragController?.dragBegin(press) ?? null,
  };
}

/**
 * Returns unlocked transform targets for the current selection.
 *
 * @param ctx Shared editor services context.
 * @returns Objects that may be transformed.
 */
function layoutToolEditorTransformTargetsResolve(ctx: LayoutToolEditorServicesContext) {
  const selected = filterUnlockedObjects(ctx.deps.selectionManager.getAllSelectedObjectsAsArray());
  return resolveTransformTargets(selected, ctx.deps.selectionManager.getInspectorObjects());
}

/**
 * Yields selectable wrappers for currently selected unlocked objects.
 *
 * @param ctx Shared editor services context.
 * @returns Selectable objects for the active tool.
 */
function layoutToolEditorSelectedObjectsIterate(ctx: LayoutToolEditorServicesContext) {
  return iterateSelectables(
    filterUnlockedObjects(ctx.deps.selectionManager.getAllSelectedObjectsAsArray()),
    ctx.selectableCache,
  );
}

/**
 * Clears the object selection set unless Edit Mode is active.
 *
 * @param ctx Shared editor services context.
 */
function layoutToolEditorObjectSelectionClear(ctx: LayoutToolEditorServicesContext): void {
  if (layoutToolEditorEditModeActiveRead(ctx)) {
    return;
  }
  ctx.deps.selectionManager.clearSelection();
}

/**
 * Picks and applies object selection at a client point.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param additive True when Shift is held.
 * @param toggle True when Ctrl or Meta is held.
 */
function layoutToolEditorObjectClickSelectionApply(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  additive: boolean,
  toggle: boolean,
): void {
  if (layoutToolEditorEditModeActiveRead(ctx)) {
    return;
  }
  applyObjectClickSelectionAtClientPoint(ctx.deps, clientX, clientY, additive, toggle, ctx.getPointerOwnerDocument());
}

/**
 * Returns whether every selected object may be scaled.
 *
 * @param ctx Shared editor services context.
 * @returns False when a selected object only moves and rotates.
 */
function layoutToolEditorSelectionScaleAllowedRead(ctx: LayoutToolEditorServicesContext): boolean {
  return entityTransformScaleAllowedAll(ctx.deps.selectionManager.getAllSelectedObjectsAsArray());
}
