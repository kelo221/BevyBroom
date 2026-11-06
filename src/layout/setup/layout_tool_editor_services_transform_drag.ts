import type { Camera, Object3D, Vector3 } from 'three';
import type { EditorServices } from '@/editor/window/editor_services.js';
import type { TransformMode } from '@/types/transform_mode.js';
import {
  applySingleUsePointerMove,
  beginSingleUseDragHiddenGizmo,
  restoreSingleUseSnapUserPreference,
  syncSingleUseSnapFromShift,
  tryBeginComponentSingleUseDrag,
} from './layout_tool_editor_helpers.js';
import {
  layoutToolEditorEditModeActiveRead,
  layoutToolEditorExclusiveViewportRootsReset,
  type LayoutToolEditorServicesContext,
} from './layout_tool_editor_services_context.js';

/** Transform drag and gizmo presentation EditorServices. */
export type LayoutToolEditorTransformDragServices = Pick<
  EditorServices,
  | 'beginSingleUseDrag'
  | 'applySingleUsePointerMove'
  | 'isTransformDragActive'
  | 'isPermanentGizmoHandleDragActive'
  | 'commitActiveTransformDrag'
  | 'cancelActiveTransformDrag'
  | 'tryBeginPermanentGizmoDragFromEditorPointer'
  | 'probePermanentGizmoUnderPointer'
  | 'publishTransformDragVisualEnd'
  | 'setWidgetMode'
  | 'getWidgetMode'
  | 'refreshGizmoPresentation'
>;

/** Single-use drag EditorServices. */
type LayoutToolEditorTransformSingleUseServices = Pick<
  EditorServices,
  'beginSingleUseDrag' | 'applySingleUsePointerMove' | 'isTransformDragActive' | 'isPermanentGizmoHandleDragActive'
>;

/** Commit, cancel, and permanent gizmo EditorServices. */
type LayoutToolEditorTransformCommitServices = Pick<
  EditorServices,
  | 'commitActiveTransformDrag'
  | 'cancelActiveTransformDrag'
  | 'tryBeginPermanentGizmoDragFromEditorPointer'
  | 'probePermanentGizmoUnderPointer'
>;

/** Widget mode and visual-end EditorServices. */
type LayoutToolEditorTransformWidgetServices = Pick<
  EditorServices,
  'publishTransformDragVisualEnd' | 'setWidgetMode' | 'getWidgetMode' | 'refreshGizmoPresentation'
>;

/** Pointer modifiers used by permanent gizmo probes. */
type LayoutToolEditorGizmoPointerModifiers = {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

/**
 * Builds transform drag and gizmo presentation services.
 *
 * @param ctx Shared editor services context.
 * @returns Transform drag services.
 */
export function layoutToolEditorTransformDragServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorTransformDragServices {
  return {
    ...layoutToolEditorTransformSingleUseServicesCreate(ctx),
    ...layoutToolEditorTransformCommitServicesCreate(ctx),
    ...layoutToolEditorTransformWidgetServicesCreate(ctx),
  };
}

/**
 * Builds single-use drag services.
 *
 * @param ctx Shared editor services context.
 * @returns Single-use services.
 */
function layoutToolEditorTransformSingleUseServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorTransformSingleUseServices {
  return {
    beginSingleUseDrag: (mode, objects, pivot, camera, pickElement, clientX, clientY) =>
      layoutToolEditorSingleUseDragBegin({ ctx, mode, objects, pivot, camera, pickElement, clientX, clientY }),
    applySingleUsePointerMove: (clientX, clientY, camera, pickElement) =>
      layoutToolEditorSingleUsePointerMoveApply(ctx, clientX, clientY, camera, pickElement),
    isTransformDragActive: () => layoutToolEditorTransformDragActiveRead(ctx),
    isPermanentGizmoHandleDragActive: () => layoutToolEditorPermanentGizmoHandleDragActiveRead(ctx),
  };
}

/**
 * Builds commit, cancel, and permanent gizmo services.
 *
 * @param ctx Shared editor services context.
 * @returns Commit services.
 */
function layoutToolEditorTransformCommitServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorTransformCommitServices {
  return {
    commitActiveTransformDrag: () => layoutToolEditorActiveTransformDragCommit(ctx),
    cancelActiveTransformDrag: () => layoutToolEditorActiveTransformDragCancel(ctx),
    tryBeginPermanentGizmoDragFromEditorPointer: (clientX, clientY, modifiers) =>
      layoutToolEditorPermanentGizmoDragBegin(ctx, clientX, clientY, modifiers),
    probePermanentGizmoUnderPointer: (clientX, clientY, modifiers) =>
      layoutToolEditorPermanentGizmoProbe(ctx, clientX, clientY, modifiers),
  };
}

/**
 * Builds widget mode and visual-end services.
 *
 * @param ctx Shared editor services context.
 * @returns Widget services.
 */
function layoutToolEditorTransformWidgetServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorTransformWidgetServices {
  return {
    publishTransformDragVisualEnd: (objects, _reason) => {
      ctx.deps.onAfterTransformCommit([...objects]);
    },
    setWidgetMode: (mode) => {
      ctx.deps.transformGizmo.setMode(mode);
    },
    getWidgetMode: () => ctx.deps.transformGizmo.getMode(),
    refreshGizmoPresentation: () => ctx.deps.refreshGizmoPresentation(),
  };
}

/** Arguments for beginning a single-use transform drag. */
interface LayoutToolEditorSingleUseDragBeginArgs {
  ctx: LayoutToolEditorServicesContext;
  mode: TransformMode;
  objects: Object3D[];
  pivot: Vector3;
  camera: Camera;
  pickElement: HTMLElement;
  clientX: number;
  clientY: number;
}

/**
 * Begins a single-use transform drag for the given mode and targets.
 *
 * @param args Drag mode, targets, pivot, camera, pick element, and pointer.
 * @returns True when started.
 */
function layoutToolEditorSingleUseDragBegin(args: LayoutToolEditorSingleUseDragBeginArgs): boolean {
  if (layoutToolEditorComponentSingleUseDragTry(args)) {
    args.ctx.deps.transformGizmo.setVisible(false);
    layoutToolEditorExclusiveViewportRootsReset(args.ctx);
    return true;
  }
  return layoutToolEditorSingleUseHiddenDragBegin(args);
}

/**
 * Starts a component single-use drag when Edit Mode has a component selection.
 *
 * @param args Drag mode, camera, pick element, and pointer.
 * @returns True when a component drag started.
 */
function layoutToolEditorComponentSingleUseDragTry(args: LayoutToolEditorSingleUseDragBeginArgs): boolean {
  return tryBeginComponentSingleUseDrag(
    args.ctx.deps,
    args.mode,
    args.camera,
    args.pickElement,
    args.clientX,
    args.clientY,
  );
}

/**
 * Begins a single-use object drag with gizmos hidden.
 *
 * @param args Drag mode, targets, pivot, camera, pick element, and pointer.
 * @returns True when the drag started.
 */
function layoutToolEditorSingleUseHiddenDragBegin(args: LayoutToolEditorSingleUseDragBeginArgs): boolean {
  return beginSingleUseDragHiddenGizmo(
    args.ctx.deps,
    args.ctx.inputBridge,
    args.mode,
    args.objects,
    args.pivot,
    args.camera,
    args.pickElement,
    args.clientX,
    args.clientY,
  );
}

/**
 * Applies a single-use pointer move sample.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param camera Camera for projection.
 * @param pickElement Pick element for NDC.
 */
function layoutToolEditorSingleUsePointerMoveApply(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  camera: Camera,
  pickElement: HTMLElement,
): void {
  if (ctx.deps.componentTransformHandler.isDragging()) {
    syncSingleUseSnapFromShift(ctx.deps);
    ctx.deps.componentTransformHandler.applyPointerMove(clientX, clientY);
    ctx.deps.getEditModeCoordinator?.()?.refreshPresentation();
    return;
  }
  applySingleUsePointerMove(ctx.deps, clientX, clientY, camera, pickElement);
}

/**
 * Returns whether a transform drag is active.
 *
 * @param ctx Shared editor services context.
 * @returns True during drag.
 */
function layoutToolEditorTransformDragActiveRead(ctx: LayoutToolEditorServicesContext): boolean {
  return ctx.deps.transformHandler.isDragging() || ctx.deps.componentTransformHandler.isDragging();
}

/**
 * Returns whether a permanent gizmo or bounds handle drag is active.
 *
 * @param ctx Shared editor services context.
 * @returns True while a handle-picked permanent drag is running.
 */
function layoutToolEditorPermanentGizmoHandleDragActiveRead(ctx: LayoutToolEditorServicesContext): boolean {
  return (
    (ctx.deps.transformHandler.isDragging() && !ctx.deps.transformHandler.isSingleUseDrag()) ||
    ctx.deps.componentTransformHandler.isPermanentDrag() ||
    ctx.componentTransformBridge.isPermanentDragActive()
  );
}

/**
 * Commits the active transform drag.
 *
 * @param ctx Shared editor services context.
 */
function layoutToolEditorActiveTransformDragCommit(ctx: LayoutToolEditorServicesContext): void {
  if (ctx.deps.componentTransformHandler.isDragging()) {
    ctx.deps.componentTransformHandler.commitIfNeeded();
    layoutToolEditorTransformDragSessionFinish(ctx);
    return;
  }
  ctx.deps.transformHandler.commitActiveDragIfNeeded();
  layoutToolEditorTransformDragSessionFinish(ctx);
}

/**
 * Cancels the active transform drag and restores poses.
 *
 * @param ctx Shared editor services context.
 */
function layoutToolEditorActiveTransformDragCancel(ctx: LayoutToolEditorServicesContext): void {
  if (ctx.deps.componentTransformHandler.isDragging()) {
    ctx.deps.componentTransformHandler.cancelIfNeeded();
    layoutToolEditorTransformDragSessionFinish(ctx);
    return;
  }
  ctx.deps.transformHandler.cancelActiveDragIfNeeded();
  layoutToolEditorTransformDragSessionFinish(ctx);
}

/**
 * Restores snap preference, exclusive viewport roots, and gizmo presentation.
 *
 * @param ctx Shared editor services context.
 */
function layoutToolEditorTransformDragSessionFinish(ctx: LayoutToolEditorServicesContext): void {
  restoreSingleUseSnapUserPreference(ctx.deps);
  layoutToolEditorExclusiveViewportRootsReset(ctx);
  ctx.deps.refreshGizmoPresentation();
}

/**
 * Probes and begins a permanent gizmo or bounds handle drag under a client
 * point.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param modifiers Modifier keys for Alt-duplicate and multi-select skip.
 * @returns True when a handle drag started.
 */
function layoutToolEditorPermanentGizmoDragBegin(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  modifiers: LayoutToolEditorGizmoPointerModifiers,
): boolean {
  if (layoutToolEditorEditModeActiveRead(ctx)) {
    return ctx.componentTransformBridge.tryBeginFromEditorPointer(clientX, clientY, modifiers);
  }
  return layoutToolEditorPermanentGizmoBridgeRead(ctx)?.tryBeginFromEditorPointer(clientX, clientY, modifiers) === true;
}

/**
 * Probes whether a permanent gizmo or bounds control is under the pointer.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param modifiers Modifier keys; multi-select skips gizmo probes.
 * @returns True when a control is under the pointer.
 */
function layoutToolEditorPermanentGizmoProbe(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  modifiers: LayoutToolEditorGizmoPointerModifiers,
): boolean {
  if (layoutToolEditorEditModeActiveRead(ctx)) {
    return ctx.componentTransformBridge.probeGizmoUnderPointer(clientX, clientY, modifiers);
  }
  return layoutToolEditorPermanentGizmoBridgeRead(ctx)?.probeGizmoUnderPointer(clientX, clientY, modifiers) === true;
}

/**
 * Returns the permanent gizmo interaction bridge when the transform system
 * exists.
 *
 * @param ctx Shared editor services context.
 * @returns Bridge instance, or null.
 */
function layoutToolEditorPermanentGizmoBridgeRead(ctx: LayoutToolEditorServicesContext) {
  return ctx.deps.getTransformInteractionBridge?.() ?? null;
}
