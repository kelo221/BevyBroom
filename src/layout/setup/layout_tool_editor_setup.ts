import { TransformMode, isBoundsWidgetMode } from '@/types/transform_mode.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { GuiWindow } from '@/editor/gui/gui_window.js';
import { ClipTool } from '@/editor/tools/clip_tool.js';
import { PolygonTool } from '@/editor/tools/polygon/polygon_tool.js';
import { EditorStalePressRelease } from '@/editor/window/editor_stale_press_release.js';
import { keyboardShortcutCodeFromEvent } from '@/input/keyboard_event_match.js';
import type { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import type { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { LayoutToolEditorSetupDeps, LayoutToolEditorSystem } from './layout_tool_editor_types.js';
import {
  layoutToolEditorSystemSessionCreate,
  type LayoutToolEditorSystemSession,
} from './layout_tool_editor_system_session.js';

export type { LayoutToolEditorSetupDeps, LayoutToolEditorSystem } from './layout_tool_editor_types.js';

/** Tool-switch and busy-state handles. */
type LayoutToolEditorSystemToolSwitchHandles = Pick<
  LayoutToolEditorSystem,
  | 'switchToTransformMode'
  | 'switchToObjectSelect'
  | 'switchToFaceSelect'
  | 'switchToEditSelect'
  | 'switchToGridTool'
  | 'switchToPolygonTool'
  | 'refreshInteractiveViewportDomain'
  | 'cancelActiveSingleUseTool'
  | 'isToolBusy'
  | 'isActiveEventReceiverBusy'
>;

/** GUI surface and focus-router handles. */
type LayoutToolEditorSystemGuiHandles = Pick<
  LayoutToolEditorSystem,
  'registerGuiSurface' | 'unregisterGuiSurface' | 'installFocusPointerRouter' | 'uninstallFocusPointerRouter'
>;

/** Keyboard, navigation-block, and clip-tool handles. */
type LayoutToolEditorSystemClipKeyHandles = Pick<
  LayoutToolEditorSystem,
  | 'handleKeyDown'
  | 'setGlobalKeyDownHandler'
  | 'setNavigationBlocksActions'
  | 'registerClipTool'
  | 'switchToClipTool'
  | 'isClipToolActive'
>;

/**
 * Creates an editor window and EditorInputBridge, wires services and exclusive
 * viewport roots, and returns tool-system handles.
 *
 * @param deps Layout services and callbacks for constructing the tool stack.
 * @returns Tool system handles.
 */
export function createLayoutToolEditorSystem(deps: LayoutToolEditorSetupDeps): LayoutToolEditorSystem {
  const session = layoutToolEditorSystemSessionCreate(deps);
  return layoutToolEditorSystemHandlesCreate(session);
}

/**
 * Builds the public tool-system handle object from a wired session.
 *
 * @param session Wired editor window, input bridge, and key-state setters.
 * @returns Tool system handles.
 */
function layoutToolEditorSystemHandlesCreate(session: LayoutToolEditorSystemSession): LayoutToolEditorSystem {
  return {
    editorWindow: session.editorWindow,
    inputBridge: session.inputBridge,
    ...layoutToolEditorSystemToolSwitchHandlesCreate(session),
    ...layoutToolEditorSystemGuiHandlesCreate(session),
    ...layoutToolEditorSystemClipKeyHandlesCreate(session),
  };
}

/**
 * Builds tool-switch and busy-state handles.
 *
 * @param session Wired editor window, input bridge, and key-state setters.
 * @returns Tool-switch handles.
 */
function layoutToolEditorSystemToolSwitchHandlesCreate(
  session: LayoutToolEditorSystemSession,
): LayoutToolEditorSystemToolSwitchHandles {
  const editorWindow = session.editorWindow;
  const polygonTool = new PolygonTool();
  return {
    switchToTransformMode: (mode) => switchPermanentTransformMode(editorWindow, mode),
    switchToObjectSelect: () => layoutToolEditorObjectSelectSwitch(editorWindow),
    switchToFaceSelect: () => layoutToolEditorFaceSelectSwitch(editorWindow),
    switchToEditSelect: () => layoutToolEditorEditSelectSwitch(editorWindow),
    switchToGridTool: () => layoutToolEditorGridToolSwitch(editorWindow),
    switchToPolygonTool: (onLeft) => layoutToolEditorPolygonToolSwitch(editorWindow, polygonTool, onLeft),
    refreshInteractiveViewportDomain: session.refreshInteractiveViewportDomain,
    cancelActiveSingleUseTool: () => cancelActiveSingleUseTool(editorWindow),
    isToolBusy: () => editorWindow.isToolBusy,
    isActiveEventReceiverBusy: () =>
      EditorStalePressRelease.busyAfterReleaseWhenNoButtonHeld(editorWindow, session.inputBridge.heldButtonsRead()),
  };
}

/**
 * Switches to the Polygon outline tool.
 *
 * @param editorWindow Editor window.
 * @param polygonTool Polygon tool receiver owned by this tool system.
 * @param onLeft Called when the editor later switches away from the tool.
 * @returns True when switched.
 */
function layoutToolEditorPolygonToolSwitch(
  editorWindow: EditorWindow,
  polygonTool: PolygonTool,
  onLeft: () => void,
): boolean {
  polygonTool.leftListenerWrite(onLeft);
  editorWindow.switchTool(polygonTool);
  return true;
}

/**
 * Builds GUI surface and focus-router handles.
 *
 * @param session Wired editor window, input bridge, and key-state setters.
 * @returns GUI handles.
 */
function layoutToolEditorSystemGuiHandlesCreate(
  session: LayoutToolEditorSystemSession,
): LayoutToolEditorSystemGuiHandles {
  const editorWindow = session.editorWindow;
  return {
    registerGuiSurface: (rootElement, surfaceId) =>
      layoutToolEditorGuiSurfaceRegister(editorWindow, rootElement, surfaceId),
    unregisterGuiSurface: (rootElement) => {
      editorWindow.unregisterGuiWindowByRoot(rootElement);
    },
    installFocusPointerRouter: (hostElement) => layoutToolEditorFocusPointerRouterInstall(session, hostElement),
    uninstallFocusPointerRouter: () => {
      session.inputBridge.uninstall();
    },
  };
}

/**
 * Builds keyboard, navigation-block, and clip-tool handles.
 *
 * @param session Wired editor window, input bridge, and key-state setters.
 * @returns Clip and key handles.
 */
function layoutToolEditorSystemClipKeyHandlesCreate(
  session: LayoutToolEditorSystemSession,
): LayoutToolEditorSystemClipKeyHandles {
  const editorWindow = session.editorWindow;
  return {
    handleKeyDown: (event) => layoutToolEditorKeyDownHandle(editorWindow, event),
    setGlobalKeyDownHandler: (handler) => session.setGlobalKeyDownHandler(handler),
    setNavigationBlocksActions: (callback) => session.setNavigationBlocksActions(callback),
    registerClipTool: (placement, handler) => layoutToolEditorClipToolRegister(editorWindow, placement, handler),
    switchToClipTool: () => editorWindow.userSwitchToClipTool(),
    isClipToolActive: () => editorWindow.isClipToolActive(),
  };
}

/**
 * Switches to the default object-select tool.
 *
 * @param editorWindow Editor window.
 * @returns True when switched.
 */
function layoutToolEditorObjectSelectSwitch(editorWindow: EditorWindow): boolean {
  editorWindow.userSwitchToBoundsTool();
  return true;
}

/**
 * Switches to the face select tool.
 *
 * @param editorWindow Editor window.
 * @returns True when switched.
 */
function layoutToolEditorFaceSelectSwitch(editorWindow: EditorWindow): boolean {
  editorWindow.userSwitchToFaceSelectTool();
  return true;
}

/**
 * Switches to the Edit Mode select tool.
 *
 * @param editorWindow Editor window.
 * @returns True when switched.
 */
function layoutToolEditorEditSelectSwitch(editorWindow: EditorWindow): boolean {
  editorWindow.userSwitchToEditSelectTool();
  return true;
}

/**
 * Switches to the grid orientation tool.
 *
 * @param editorWindow Editor window.
 * @returns True when switched.
 */
function layoutToolEditorGridToolSwitch(editorWindow: EditorWindow): boolean {
  editorWindow.userSwitchToGridTool();
  return true;
}

/**
 * Registers a floating tool window with the focus system.
 *
 * @param editorWindow Editor window.
 * @param rootElement Panel root element.
 * @param surfaceId Stable surface id.
 */
function layoutToolEditorGuiSurfaceRegister(
  editorWindow: EditorWindow,
  rootElement: HTMLElement,
  surfaceId: string,
): void {
  editorWindow.registerGuiWindow(new GuiWindow(rootElement, surfaceId));
}

/**
 * Installs capture-phase focus pointer routing on the editor host.
 *
 * @param session Wired editor window, input bridge, and key-state setters.
 * @param hostElement Element that contains floating panels.
 */
function layoutToolEditorFocusPointerRouterInstall(
  session: LayoutToolEditorSystemSession,
  hostElement: HTMLElement,
): void {
  session.inputBridge.install(hostElement);
  session.refreshInteractiveViewportDomain();
}

/**
 * Routes a keyboard event through the editor window.
 *
 * @param editorWindow Editor window.
 * @param event Browser keyboard event.
 * @returns True when consumed.
 */
function layoutToolEditorKeyDownHandle(editorWindow: EditorWindow, event: KeyboardEvent): boolean {
  const keyCode = keyboardShortcutCodeFromEvent(event);
  return editorWindow.onKeyDown(keyCode, event);
}

/**
 * Registers the clip plane tool with the editor window.
 *
 * @param editorWindow Editor window.
 * @param placement Clip placement model.
 * @param handler Clip interaction handler.
 * @returns Registered clip tool.
 */
function layoutToolEditorClipToolRegister(
  editorWindow: EditorWindow,
  placement: ToolClipPlane,
  handler: HandlerClipPlane,
): ClipTool {
  const clipTool = new ClipTool(placement, handler);
  editorWindow.setClipTool(clipTool);
  return clipTool;
}

/**
 * Switches to a permanent transform tool (toolbar SwitchTool).
 *
 * @param editorWindow Editor window.
 * @param mode Transform mode.
 * @returns True when switched.
 */
function switchPermanentTransformMode(editorWindow: EditorWindow, mode: TransformMode): boolean {
  if (layoutToolEditorNamedTransformModeSwitch(editorWindow, mode)) {
    return true;
  }
  if (layoutToolEditorBoundsModeSwitch(editorWindow, mode)) {
    return true;
  }
  editorWindow.userSwitchToBoundsTool();
  return true;
}

/**
 * Switches to translate, rotate, or scale when the mode is one of those.
 *
 * @param editorWindow Editor window.
 * @param mode Transform mode.
 * @returns True when switched.
 */
function layoutToolEditorNamedTransformModeSwitch(editorWindow: EditorWindow, mode: TransformMode): boolean {
  if (mode === TransformMode.TRANSLATE) {
    editorWindow.userSwitchToTranslateTool();
    return true;
  }
  if (mode === TransformMode.ROTATE) {
    editorWindow.userSwitchToRotateTool();
    return true;
  }
  if (mode === TransformMode.SCALE) {
    editorWindow.userSwitchToScaleTool();
    return true;
  }
  return false;
}

/**
 * Switches to bounds or shear when the mode is a bounds widget mode.
 *
 * @param editorWindow Editor window.
 * @param mode Transform mode.
 * @returns True when switched.
 */
function layoutToolEditorBoundsModeSwitch(editorWindow: EditorWindow, mode: TransformMode): boolean {
  if (!isBoundsWidgetMode(mode)) {
    return false;
  }
  editorWindow.userSwitchToBoundsTool();
  if (mode === TransformMode.SHEAR) {
    editorWindow.userSwitchToShearTool();
  }
  return true;
}

/**
 * Cancels the active single-use tool when one is running (Shape Editor Escape).
 *
 * @param editorWindow Editor window.
 * @returns True when a single-use tool was cancelled.
 */
function cancelActiveSingleUseTool(editorWindow: EditorWindow): boolean {
  const active = editorWindow.activeTool;
  if (!active || !active.isSingleUse) {
    return false;
  }
  active.onKeyDown('Escape');
  return true;
}
