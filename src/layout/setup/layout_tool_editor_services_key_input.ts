import type { EditorServices } from '@/editor/window/editor_services.js';
import { handleModalKeyDownWithLiveVisuals, resolveLastPointerClientPosition } from './layout_tool_editor_helpers.js';
import {
  layoutToolEditorAltPressedResolve,
  layoutToolEditorAnyModifierPressedResolve,
  layoutToolEditorCtrlPressedResolve,
  layoutToolEditorShiftPressedResolve,
} from './layout_tool_editor_modifier_keys.js';
import type { LayoutToolEditorServicesContext } from './layout_tool_editor_services_context.js';

/** Modal key, status, undo, and modifier EditorServices. */
export type LayoutToolEditorKeyInputServices = Pick<
  EditorServices,
  | 'handleModalKeyDown'
  | 'setStatusMessage'
  | 'registerUndo'
  | 'discardUndo'
  | 'getLastPointerClientPosition'
  | 'isShiftPressed'
  | 'isCtrlPressed'
  | 'isAltPressed'
  | 'isModifierPressed'
  | 'handleGlobalKeyDown'
  | 'isNavigationBlockingTools'
>;

/** Modal key, status, and undo EditorServices. */
type LayoutToolEditorKeyModalServices = Pick<
  EditorServices,
  'handleModalKeyDown' | 'setStatusMessage' | 'registerUndo' | 'discardUndo' | 'getLastPointerClientPosition'
>;

/** Modifier and global keydown EditorServices. */
type LayoutToolEditorKeyModifierServices = Pick<
  EditorServices,
  | 'isShiftPressed'
  | 'isCtrlPressed'
  | 'isAltPressed'
  | 'isModifierPressed'
  | 'handleGlobalKeyDown'
  | 'isNavigationBlockingTools'
>;

/**
 * Builds modal key, status, undo, and modifier services.
 *
 * @param ctx Shared editor services context.
 * @returns Key input services.
 */
export function layoutToolEditorKeyInputServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorKeyInputServices {
  return {
    ...layoutToolEditorKeyModalServicesCreate(ctx),
    ...layoutToolEditorKeyModifierServicesCreate(ctx),
  };
}

/**
 * Builds modal key, status, and undo services.
 *
 * @param ctx Shared editor services context.
 * @returns Modal services.
 */
function layoutToolEditorKeyModalServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorKeyModalServices {
  return {
    handleModalKeyDown: (_keyCode, event) => handleModalKeyDownWithLiveVisuals(ctx.deps, event),
    setStatusMessage: (message) => ctx.deps.setStatusMessage(message),
    registerUndo: (_name) => {},
    discardUndo: () => {},
    getLastPointerClientPosition: (ownerDocument) => resolveLastPointerClientPosition(ctx.deps, ownerDocument),
  };
}

/**
 * Builds modifier and global keydown services.
 *
 * @param ctx Shared editor services context.
 * @returns Modifier services.
 */
function layoutToolEditorKeyModifierServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorKeyModifierServices {
  return {
    isShiftPressed: () => layoutToolEditorShiftPressedResolve(ctx.deps, ctx.getLatchedModifierFlags),
    isCtrlPressed: () => layoutToolEditorCtrlPressedResolve(ctx.deps, ctx.getLatchedModifierFlags),
    isAltPressed: () => layoutToolEditorAltPressedResolve(ctx.deps, ctx.getLatchedModifierFlags),
    isModifierPressed: () => layoutToolEditorAnyModifierPressedResolve(ctx.deps, ctx.getLatchedModifierFlags),
    handleGlobalKeyDown: (_keyCode, event) => ctx.getGlobalKeyDown()?.(event) === true,
    isNavigationBlockingTools: () => ctx.getNavigationBlocks()?.() === true,
  };
}
