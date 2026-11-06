import { EditorWindow } from '@/editor/window/editor_window.js';
import { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { EditorServices } from '@/editor/window/editor_services.js';
import { audioViewportFocus } from '@/audio/spatial/audio_viewport_focus.js';
import { createEditorServices } from './layout_tool_editor_services.js';
import {
  collectInteractivePickElements,
  objectDragControllerCreate,
  syncAudioViewportContentRegistry,
  wireAfterDragVisualRefresh,
} from './layout_tool_editor_helpers.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_types.js';

/** Mutable global keydown and navigation-block callbacks. */
interface LayoutToolEditorSystemKeyState {
  globalKeyDown: ((event: KeyboardEvent) => boolean) | null;
  navigationBlocks: (() => boolean) | null;
}

/** Wired editor window, input bridge, and live key-state setters. */
export interface LayoutToolEditorSystemSession {
  editorWindow: EditorWindow;
  inputBridge: EditorInputBridge;
  refreshInteractiveViewportDomain: () => void;
  setGlobalKeyDownHandler: (handler: (event: KeyboardEvent) => boolean) => void;
  setNavigationBlocksActions: (callback: () => boolean) => void;
}

/**
 * Creates the editor window, wires services and exclusive viewport roots, and
 * returns the live session.
 *
 * @param deps Layout services and callbacks for constructing the tool stack.
 * @returns Wired session used to build tool-system handles.
 */
export function layoutToolEditorSystemSessionCreate(deps: LayoutToolEditorSetupDeps): LayoutToolEditorSystemSession {
  const editorWindow = new EditorWindow();
  const inputBridge = new EditorInputBridge(editorWindow);
  const keyState = layoutToolEditorSystemKeyStateCreate(deps);
  editorWindow.setServices(layoutToolEditorSystemServicesCreate(deps, editorWindow, inputBridge, keyState));
  editorWindow.validateTools();
  const session = layoutToolEditorSystemSessionAssemble(deps, editorWindow, inputBridge, keyState);
  layoutToolEditorSystemSessionWire(deps, session);
  return session;
}

/**
 * Builds mutable global keydown and navigation-block state.
 *
 * @param deps Layout services and callbacks for constructing the tool stack.
 * @returns Mutable key-state bag.
 */
function layoutToolEditorSystemKeyStateCreate(deps: LayoutToolEditorSetupDeps): LayoutToolEditorSystemKeyState {
  return {
    globalKeyDown: deps.handleGlobalKeyDown ?? null,
    navigationBlocks: deps.isNavigationBlockingTools ?? null,
  };
}

/**
 * Builds map-editor services bound to the live window and key state.
 *
 * @param deps Layout services.
 * @param editorWindow Editor window that owns pointer samples.
 * @param inputBridge Input bridge for exclusive viewport root.
 * @param keyState Mutable global keydown and navigation-block callbacks.
 * @returns Services implementation.
 */
function layoutToolEditorSystemServicesCreate(
  deps: LayoutToolEditorSetupDeps,
  editorWindow: EditorWindow,
  inputBridge: EditorInputBridge,
  keyState: LayoutToolEditorSystemKeyState,
): EditorServices {
  return createEditorServices(
    deps,
    () => keyState.globalKeyDown,
    () => keyState.navigationBlocks,
    inputBridge,
    () => editorWindow.lastPointerOwnerDocument,
    () => editorWindow.getLatchedModifierFlags(),
    objectDragControllerCreate(deps, () => editorWindow.lastPointerOwnerDocument),
  );
}

/**
 * Assembles the live session bag around the window, bridge, and key state.
 *
 * @param deps Layout services.
 * @param editorWindow Editor window.
 * @param inputBridge Input bridge.
 * @param keyState Mutable global keydown and navigation-block callbacks.
 * @returns Session bag.
 */
function layoutToolEditorSystemSessionAssemble(
  deps: LayoutToolEditorSetupDeps,
  editorWindow: EditorWindow,
  inputBridge: EditorInputBridge,
  keyState: LayoutToolEditorSystemKeyState,
): LayoutToolEditorSystemSession {
  return {
    editorWindow,
    inputBridge,
    refreshInteractiveViewportDomain: () => layoutToolEditorInteractiveViewportDomainRefresh(deps, inputBridge),
    setGlobalKeyDownHandler: (handler) => {
      keyState.globalKeyDown = handler;
    },
    setNavigationBlocksActions: (callback) => {
      keyState.navigationBlocks = callback;
    },
  };
}

/**
 * Wires after-drag visual refresh, audio focus, and exclusive viewport roots.
 *
 * @param deps Layout services.
 * @param session Live session bag.
 */
function layoutToolEditorSystemSessionWire(
  deps: LayoutToolEditorSetupDeps,
  session: LayoutToolEditorSystemSession,
): void {
  wireAfterDragVisualRefresh(deps);
  session.inputBridge.setExclusiveRootHitListener((root) => {
    audioViewportFocus.recordFromContentElement(root);
  });
  session.refreshInteractiveViewportDomain();
}

/**
 * Re-pins exclusive routing roots and syncs the audio viewport registry.
 *
 * @param deps Layout services.
 * @param inputBridge Input bridge for exclusive viewport root.
 */
function layoutToolEditorInteractiveViewportDomainRefresh(
  deps: LayoutToolEditorSetupDeps,
  inputBridge: EditorInputBridge,
): void {
  syncAudioViewportContentRegistry(deps);
  inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
}
