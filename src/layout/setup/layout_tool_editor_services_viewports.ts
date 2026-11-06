import type { EditorServices } from '@/editor/window/editor_services.js';
import {
  collectInteractivePickElements,
  resolveFirstInteractiveViewportInDocument,
  resolveInteractiveViewportAtClientPoint,
} from './layout_tool_editor_helpers.js';
import {
  layoutToolEditorEditModeActiveRead,
  layoutToolEditorExclusiveViewportRootsReset,
  type LayoutToolEditorServicesContext,
} from './layout_tool_editor_services_context.js';

/** Camera, exclusive viewport, bounds hover, and grid-align EditorServices. */
export type LayoutToolEditorViewportServices = Pick<
  EditorServices,
  | 'getActiveCamera'
  | 'getActivePickElement'
  | 'resolveInteractiveViewportAtClientPoint'
  | 'resolveFirstInteractiveViewportInDocument'
  | 'getInteractiveViewportPickElements'
  | 'pinExclusiveViewportDomain'
  | 'pinExclusiveViewport'
  | 'clearExclusiveViewport'
  | 'updateBoundsHoverAtClientPoint'
  | 'clearBoundsHoverAtClientPoint'
  | 'isGridAlignPickArmed'
  | 'disarmGridAlignPick'
  | 'tryGridAlignPickAtPointer'
  | 'updateGridAlignHoverAtPointer'
>;

/** Camera and pick-element EditorServices. */
type LayoutToolEditorViewportCameraServices = Pick<
  EditorServices,
  | 'getActiveCamera'
  | 'getActivePickElement'
  | 'resolveInteractiveViewportAtClientPoint'
  | 'resolveFirstInteractiveViewportInDocument'
  | 'getInteractiveViewportPickElements'
>;

/** Exclusive viewport pin EditorServices. */
type LayoutToolEditorViewportPinServices = Pick<
  EditorServices,
  'pinExclusiveViewportDomain' | 'pinExclusiveViewport' | 'clearExclusiveViewport'
>;

/** Bounds hover and grid-align EditorServices. */
type LayoutToolEditorViewportHoverServices = Pick<
  EditorServices,
  | 'updateBoundsHoverAtClientPoint'
  | 'clearBoundsHoverAtClientPoint'
  | 'isGridAlignPickArmed'
  | 'disarmGridAlignPick'
  | 'tryGridAlignPickAtPointer'
  | 'updateGridAlignHoverAtPointer'
>;

/**
 * Builds camera, exclusive viewport, bounds hover, and grid-align services.
 *
 * @param ctx Shared editor services context.
 * @returns Viewport services.
 */
export function layoutToolEditorViewportServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorViewportServices {
  return {
    ...layoutToolEditorViewportCameraServicesCreate(ctx),
    ...layoutToolEditorViewportPinServicesCreate(ctx),
    ...layoutToolEditorViewportHoverServicesCreate(ctx),
  };
}

/**
 * Builds camera and pick-element services.
 *
 * @param ctx Shared editor services context.
 * @returns Camera services.
 */
function layoutToolEditorViewportCameraServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorViewportCameraServices {
  return {
    getActiveCamera: () => ctx.deps.getActiveViewport()?.getCamera() ?? null,
    getActivePickElement: () => ctx.deps.getActiveViewport()?.getContentElement() ?? null,
    resolveInteractiveViewportAtClientPoint: (clientX, clientY, ownerDocument) =>
      resolveInteractiveViewportAtClientPoint(ctx.deps, clientX, clientY, ownerDocument),
    resolveFirstInteractiveViewportInDocument: (ownerDocument) =>
      resolveFirstInteractiveViewportInDocument(ctx.deps, ownerDocument),
    getInteractiveViewportPickElements: () => collectInteractivePickElements(ctx.deps),
  };
}

/**
 * Builds exclusive viewport pin services.
 *
 * @param ctx Shared editor services context.
 * @returns Pin services.
 */
function layoutToolEditorViewportPinServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorViewportPinServices {
  return {
    pinExclusiveViewportDomain: (pickElements) => {
      ctx.inputBridge.setExclusiveViewportRoots(pickElements);
    },
    pinExclusiveViewport: (pickElement) => layoutToolEditorExclusiveViewportPin(ctx, pickElement),
    clearExclusiveViewport: () => layoutToolEditorExclusiveViewportRootsReset(ctx),
  };
}

/**
 * Builds bounds hover and grid-align services.
 *
 * @param ctx Shared editor services context.
 * @returns Hover services.
 */
function layoutToolEditorViewportHoverServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorViewportHoverServices {
  return {
    updateBoundsHoverAtClientPoint: (clientX, clientY) => layoutToolEditorBoundsHoverUpdate(ctx, clientX, clientY),
    clearBoundsHoverAtClientPoint: () => layoutToolEditorBoundsHoverClear(ctx),
    isGridAlignPickArmed: () => ctx.deps.getGridOrientationHandler?.()?.isAlignPickArmed() === true,
    disarmGridAlignPick: () => {
      ctx.deps.getGridOrientationHandler?.()?.disarmAlignPick();
    },
    tryGridAlignPickAtPointer: (clientX, clientY) => layoutToolEditorGridAlignPickTry(ctx, clientX, clientY),
    updateGridAlignHoverAtPointer: (clientX, clientY) => layoutToolEditorGridAlignHoverUpdate(ctx, clientX, clientY),
  };
}

/**
 * Pins a single viewport content element, or every interactive pane when
 * omitted.
 *
 * @param ctx Shared editor services context.
 * @param pickElement One content element, or null or undefined for all panes.
 */
function layoutToolEditorExclusiveViewportPin(
  ctx: LayoutToolEditorServicesContext,
  pickElement?: HTMLElement | null,
): void {
  if (pickElement === undefined || pickElement === null) {
    layoutToolEditorExclusiveViewportRootsReset(ctx);
    return;
  }
  ctx.inputBridge.setExclusiveViewportRoot(pickElement);
}

/**
 * Updates bounds face hover highlight and resize cursors under a client point.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 */
function layoutToolEditorBoundsHoverUpdate(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
): void {
  const bridge = ctx.deps.getTransformInteractionBridge?.() ?? null;
  if (!bridge) {
    return;
  }
  if (layoutToolEditorEditModeActiveRead(ctx)) {
    bridge.clearBoundsHover();
    return;
  }
  bridge.updateBoundsHoverAtClientPoint(clientX, clientY);
}

/**
 * Clears bounds face hover and forgets the cached hover cursor.
 *
 * @param ctx Shared editor services context.
 */
function layoutToolEditorBoundsHoverClear(ctx: LayoutToolEditorServicesContext): void {
  const bridge = ctx.deps.getTransformInteractionBridge?.() ?? null;
  if (!bridge) {
    return;
  }
  bridge.clearBoundsHover();
}

/**
 * Attempts a grid face-align pick at the given client point.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns True when a face was aligned.
 */
function layoutToolEditorGridAlignPickTry(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
): boolean {
  return (
    ctx.deps
      .getGridOrientationHandler?.()
      ?.tryAlignPickAtClientPoint(clientX, clientY, ctx.getPointerOwnerDocument()) === true
  );
}

/**
 * Updates the orange face hover while grid align pick is armed.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 */
function layoutToolEditorGridAlignHoverUpdate(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
): void {
  ctx.deps.getGridOrientationHandler?.()?.updateHoverAtClientPoint(clientX, clientY, ctx.getPointerOwnerDocument());
}
