import { TransformMode, isBoundsWidgetMode } from '@/types/transform_mode.js';
import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import { GuiWindow } from '@/editor/gui/gui_window.js';
import { ClipTool } from '@/editor/tools/clip_tool.js';
import { keyboardShortcutCodeFromEvent } from '@/input/keyboard_event_match.js';
import { audioViewportFocus } from '@/audio/spatial/audio_viewport_focus.js';
import type { LayoutToolEditorSetupDeps, LayoutToolEditorSystem } from './layout_tool_editor_types.js';
import { createEditorServices } from './layout_tool_editor_services.js';
import {
  collectInteractivePickElements,
  objectDragControllerCreate,
  syncAudioViewportContentRegistry,
  wireAfterDragVisualRefresh,
} from './layout_tool_editor_helpers.js';

export type { LayoutToolEditorSetupDeps, LayoutToolEditorSystem } from './layout_tool_editor_types.js';

/**
 * Creates an editor window and EditorInputBridge, wires services and exclusive
 * viewport roots, and returns tool-system handles.
 *
 * @param deps Layout services and callbacks for constructing the tool stack.
 * @returns Tool system handles.
 */
export function createLayoutToolEditorSystem(deps: LayoutToolEditorSetupDeps): LayoutToolEditorSystem {
  const editorWindow = new EditorWindow();
  const inputBridge = new EditorInputBridge(editorWindow);
  let globalKeyDown: ((event: KeyboardEvent) => boolean) | null = deps.handleGlobalKeyDown ?? null;
  let navigationBlocks: (() => boolean) | null = deps.isNavigationBlockingTools ?? null;
  const services = createEditorServices(
    deps,
    () => globalKeyDown,
    () => navigationBlocks,
    inputBridge,
    () => editorWindow.lastPointerOwnerDocument,
    () => editorWindow.getLatchedModifierFlags(),
    objectDragControllerCreate(deps, () => editorWindow.lastPointerOwnerDocument),
  );
  editorWindow.setServices(services);
  editorWindow.validateTools();
  wireAfterDragVisualRefresh(deps);
  const refreshInteractiveViewportDomain = (): void => {
    syncAudioViewportContentRegistry(deps);
    inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
  };
  inputBridge.setExclusiveRootHitListener((root) => {
    audioViewportFocus.recordFromContentElement(root);
  });
  refreshInteractiveViewportDomain();
  return {
    editorWindow,
    inputBridge,
    switchToTransformMode: (mode) => switchPermanentTransformMode(editorWindow, mode),
    switchToObjectSelect: () => {
      editorWindow.userSwitchToBoundsTool();
      return true;
    },
    switchToFaceSelect: () => {
      editorWindow.userSwitchToFaceSelectTool();
      return true;
    },
    switchToEditSelect: () => {
      editorWindow.userSwitchToEditSelectTool();
      return true;
    },
    switchToGridTool: () => {
      editorWindow.userSwitchToGridTool();
      return true;
    },
    refreshInteractiveViewportDomain,
    cancelActiveSingleUseTool: () => cancelActiveSingleUseTool(editorWindow),
    isToolBusy: () => editorWindow.isToolBusy,
    isActiveEventReceiverBusy: () => editorWindow.isActiveEventReceiverBusy,
    registerGuiSurface: (rootElement, surfaceId) => {
      editorWindow.registerGuiWindow(new GuiWindow(rootElement, surfaceId));
    },
    unregisterGuiSurface: (rootElement) => {
      editorWindow.unregisterGuiWindowByRoot(rootElement);
    },
    installFocusPointerRouter: (hostElement) => {
      inputBridge.install(hostElement);
      refreshInteractiveViewportDomain();
    },
    uninstallFocusPointerRouter: () => {
      inputBridge.uninstall();
    },
    handleKeyDown: (event) => {
      const keyCode = keyboardShortcutCodeFromEvent(event);
      return editorWindow.onKeyDown(keyCode, event);
    },
    setGlobalKeyDownHandler: (handler) => {
      globalKeyDown = handler;
    },
    setNavigationBlocksActions: (callback) => {
      navigationBlocks = callback;
    },
    registerClipTool: (placement, handler) => {
      const clipTool = new ClipTool(placement, handler);
      editorWindow.setClipTool(clipTool);
      return clipTool;
    },
    switchToClipTool: () => editorWindow.userSwitchToClipTool(),
    isClipToolActive: () => editorWindow.isClipToolActive(),
  };
}

/**
 * Switches to a permanent transform tool (toolbar SwitchTool).
 *
 * @param editorWindow Editor window.
 * @param mode Transform mode.
 * @returns True when switched.
 */
function switchPermanentTransformMode(editorWindow: EditorWindow, mode: TransformMode): boolean {
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
  if (isBoundsWidgetMode(mode)) {
    editorWindow.userSwitchToBoundsTool();
    if (mode === TransformMode.SHEAR) {
      editorWindow.userSwitchToShearTool();
    }
    return true;
  }
  editorWindow.userSwitchToBoundsTool();
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

