import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { ManagerSnap } from '@/transform/snap/manager_snap.js';
import { EditorApi } from '@/ai/client/editor_api.js';
import { sharedMcpBridgeHandler } from '@/ai/client/handler_mcp_bridge.js';
import type { EditorApiHost } from '@/ai/client/editor_api_host.js';

/** Host fields required to wire the AI EditorApi bridge. */
export interface LayoutAiSetupHost {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  solidModelController: SolidModelController | null;
  gridSnap: GridSnap;
  snapManager: ManagerSnap;
  getUserSnapEnabled: () => boolean;
  refreshAfterWorldMutation: () => void;
  refreshOutliner: () => void;
  showStatusMessage: (message: string) => void;
  /** Shared editor scene for offline AI capture_view. */
  getScene?: () => THREE.Scene | null;
  /** Shared WebGL renderer for offline AI capture_view. */
  getRenderer?: () => THREE.WebGLRenderer | null;
  /** Returns the game preview link, creating it on first use. */
  previewLinkServiceEnsure?: EditorApiHost['previewLinkServiceEnsure'];
  /** Returns the project workbench, creating it on first use. */
  projectWorkbenchEnsure?: EditorApiHost['projectWorkbenchEnsure'];
  /** Replaces the open scene with scene file text as Load does. */
  sceneDocumentLoad?: EditorApiHost['sceneDocumentLoad'];
  /** Validates the map at once and returns the issues the Issues tab shows. */
  issuesValidateNow?: EditorApiHost['issuesValidateNow'];
  /** Returns the control of the main window docks and bars. */
  mainWindowControlRead?: EditorApiHost['mainWindowControlRead'];
  /** Returns the interactive views viewport_drag and viewport_click drive. */
  viewportsInteractiveRead?: EditorApiHost['viewportsInteractiveRead'];
}

/** Result of AI layout wiring. */
export interface LayoutAiSetupResult {
  editorApi: EditorApi | null;
}

/**
 * Binds the EditorApi facade for MCP tool calls. UI lives on the main toolbar
 * (MCP dialog), not a separate strip.
 *
 * @param host Layout host with live editor systems.
 * @returns Bound API or null when solid tools are unavailable.
 */
export function setupLayoutAi(host: LayoutAiSetupHost): LayoutAiSetupResult {
  if (!host.solidModelController) {
    return { editorApi: null };
  }
  const editorApi = new EditorApi({
    worldObject: host.worldObject,
    commandStack: host.commandStack,
    selectionManager: host.selectionManager,
    solidModelController: host.solidModelController,
    gridSnap: host.gridSnap,
    snapManager: host.snapManager,
    getUserSnapEnabled: host.getUserSnapEnabled,
    refreshAfterWorldMutation: host.refreshAfterWorldMutation,
    refreshOutliner: host.refreshOutliner,
    showStatus: host.showStatusMessage,
    ...(host.getScene ? { getScene: host.getScene } : {}),
    ...(host.getRenderer ? { getRenderer: host.getRenderer } : {}),
    ...(host.previewLinkServiceEnsure ? { previewLinkServiceEnsure: host.previewLinkServiceEnsure } : {}),
    ...(host.projectWorkbenchEnsure ? { projectWorkbenchEnsure: host.projectWorkbenchEnsure } : {}),
    ...(host.sceneDocumentLoad ? { sceneDocumentLoad: host.sceneDocumentLoad } : {}),
    ...(host.issuesValidateNow ? { issuesValidateNow: host.issuesValidateNow } : {}),
    ...(host.mainWindowControlRead ? { mainWindowControlRead: host.mainWindowControlRead } : {}),
    ...(host.viewportsInteractiveRead ? { viewportsInteractiveRead: host.viewportsInteractiveRead } : {}),
  });
  sharedMcpBridgeHandler.bindEditorApi(editorApi);
  return { editorApi };
}
