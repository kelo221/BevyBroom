import type * as THREE from 'three';
import type { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import type { BridgeComponentTransformInteraction } from '@/edit/transform/bridge_component_transform_interaction.js';
import type { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { ISelectable } from '@/editor/i_selectable.js';
import type { DomModifierKeyFlags } from '@/input/modifier_keys_query.js';
import type { ObjectDragController } from '@/tools/object_drag/object_drag_controller.js';
import { collectInteractivePickElements, createComponentTransformBridge } from './layout_tool_editor_helpers.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_types.js';

/** Arguments used to build the shared editor services context. */
export interface LayoutToolEditorServicesContextArgs {
  deps: LayoutToolEditorSetupDeps;
  getGlobalKeyDown: () => ((event: KeyboardEvent) => boolean) | null;
  getNavigationBlocks: () => (() => boolean) | null;
  getPointerOwnerDocument: () => Document | null;
  getLatchedModifierFlags: () => DomModifierKeyFlags | null;
  inputBridge: EditorInputBridge;
  objectDragController: ObjectDragController | null;
}

/** Shared state for the map-editor EditorServices factories. */
export interface LayoutToolEditorServicesContext extends LayoutToolEditorServicesContextArgs {
  selectableCache: Map<THREE.Object3D, ISelectable>;
  componentTransformBridge: BridgeComponentTransformInteraction;
}

/**
 * Pins exclusive viewport routing roots to every interactive pane.
 *
 * @param ctx Shared editor services context.
 */
export function layoutToolEditorExclusiveViewportRootsReset(ctx: LayoutToolEditorServicesContext): void {
  ctx.inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(ctx.deps));
}

/**
 * Returns the Edit Mode coordinator when the layout has one.
 *
 * @param ctx Shared editor services context.
 * @returns Coordinator, or null.
 */
export function layoutToolEditorEditModeCoordinatorRead(
  ctx: LayoutToolEditorServicesContext,
): CoordinatorEditMode | null {
  return ctx.deps.getEditModeCoordinator?.() ?? null;
}

/**
 * Returns whether Edit Mode is currently active.
 *
 * @param ctx Shared editor services context.
 * @returns True while component editing is live.
 */
export function layoutToolEditorEditModeActiveRead(ctx: LayoutToolEditorServicesContext): boolean {
  return layoutToolEditorEditModeCoordinatorRead(ctx)?.isActive() === true;
}

/**
 * Builds the shared editor services context.
 *
 * @param args Layout services and live getters for the tool stack.
 * @returns Context consumed by the EditorServices factories.
 */
export function layoutToolEditorServicesContextCreate(
  args: LayoutToolEditorServicesContextArgs,
): LayoutToolEditorServicesContext {
  return {
    ...args,
    selectableCache: new Map<THREE.Object3D, ISelectable>(),
    componentTransformBridge: createComponentTransformBridge(args.deps, args.getPointerOwnerDocument),
  };
}
