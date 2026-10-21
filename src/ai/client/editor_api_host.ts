import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { ManagerSnap } from '@/transform/snap/manager_snap.js';
import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import type { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import type { ShellMainWindowControl } from '@/layout/shell/actions/shell_main_window_control.js';
import type { ViewportKind } from '@/viewports/core/viewport_kind.js';

/**
 * Dependencies injected into EditorApi once at layout bootstrap. Keeps AI code
 * from reaching into layout managers directly.
 */
export interface EditorApiHost {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  solidModelController: SolidModelController;
  gridSnap: GridSnap;
  snapManager: ManagerSnap;
  getUserSnapEnabled: () => boolean;
  refreshAfterWorldMutation: () => void;
  refreshOutliner: () => void;
  showStatus: (message: string) => void;
  /**
   * Shared editor scene for capture_view. Set by layout bootstrap; unit tests
   * may omit it.
   */
  getScene?: () => THREE.Scene | null;
  /**
   * Shared WebGL renderer for capture_view. Set by layout bootstrap; unit tests
   * may omit it.
   */
  getRenderer?: () => THREE.WebGLRenderer | null;
  /**
   * Returns the game preview link, creating it on first use. Set by layout
   * bootstrap; unit tests may omit it.
   */
  previewLinkServiceEnsure?: () => PreviewLinkService;
  /**
   * Replaces the open scene with scene file text as Load does. Set by layout
   * bootstrap; unit tests may omit it.
   *
   * @param sceneJson Scene file text.
   * @returns True when the scene loaded.
   */
  sceneDocumentLoad?: (sceneJson: string) => boolean;
  /**
   * Returns the console log console_read reads. Unit tests may omit it; the
   * shared log is read then.
   */
  consoleLogRead?: () => ConsoleLog;
  /**
   * Validates the map now and refreshes the Issues view. Set by layout
   * bootstrap; when omitted issues_list runs the registered providers itself.
   *
   * @returns The new issues.
   */
  issuesValidateNow?: () => readonly Issue[];
  /**
   * Returns the control of the main window docks and bars. Set by layout
   * bootstrap; unit tests may omit it.
   *
   * @returns Main window control, or null before the main window exists.
   */
  mainWindowControlRead?: () => ShellMainWindowControl | null;
  /**
   * Returns every interactive view (2D and 3D, including detached windows) for
   * viewport_drag and viewport_click. Set by layout bootstrap; when omitted the
   * viewport input tools find no view.
   *
   * @returns Interactive views.
   */
  viewportsInteractiveRead?: () => readonly EditorApiViewportView[];
}

/** View members the viewport input tools need (2D and 3D panes satisfy it). */
export interface EditorApiViewportView {
  getViewportKind(): ViewportKind;
  getContentElement(): HTMLElement;
  getCamera(): THREE.Camera;
}
