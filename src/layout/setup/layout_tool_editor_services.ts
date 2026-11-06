import type { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import type { DomModifierKeyFlags } from '@/input/modifier_keys_query.js';
import type { ObjectDragController } from '@/tools/object_drag/object_drag_controller.js';
import { layoutToolEditorFaceServicesCreate } from './layout_tool_editor_face_services.js';
import { layoutToolEditorEditModeServicesCreate } from './layout_tool_editor_services_edit_mode.js';
import { layoutToolEditorKeyInputServicesCreate } from './layout_tool_editor_services_key_input.js';
import { layoutToolEditorSelectionServicesCreate } from './layout_tool_editor_services_selection.js';
import { layoutToolEditorTransformDragServicesCreate } from './layout_tool_editor_services_transform_drag.js';
import { layoutToolEditorViewportServicesCreate } from './layout_tool_editor_services_viewports.js';
import { layoutToolEditorServicesContextCreate } from './layout_tool_editor_services_context.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_types.js';

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
  const ctx = layoutToolEditorServicesContextCreate({
    deps,
    getGlobalKeyDown,
    getNavigationBlocks,
    getPointerOwnerDocument,
    getLatchedModifierFlags,
    inputBridge,
    objectDragController,
  });
  return layoutToolEditorServicesCompose(ctx);
}

/**
 * Spreads the EditorServices factory slices in override order.
 *
 * @param ctx Shared editor services context.
 * @returns Combined services implementation.
 */
function layoutToolEditorServicesCompose(
  ctx: ReturnType<typeof layoutToolEditorServicesContextCreate>,
): EditorServices {
  return {
    ...layoutToolEditorSelectionServicesCreate(ctx),
    ...layoutToolEditorViewportServicesCreate(ctx),
    ...layoutToolEditorTransformDragServicesCreate(ctx),
    ...layoutToolEditorEditModeServicesCreate(ctx),
    ...layoutToolEditorKeyInputServicesCreate(ctx),
    ...layoutToolEditorFaceServicesCreate(
      () => ctx.deps.getFaceModeCoordinator?.() ?? null,
      ctx.getPointerOwnerDocument,
    ),
  };
}
