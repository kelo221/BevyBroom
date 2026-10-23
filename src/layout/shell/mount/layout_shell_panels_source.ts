import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import type { FaceInspectorSetupDeps } from '@/texture/layout/layout_face_inspector_setup.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import type { EntityBrowserPlacementHost } from '@/entity_browser/placement/entity_browser_placement_at_client_point.js';
import type { EntityBrowserSetupHost } from '@/entity_browser/setup/entity_browser_setup.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import { shellIssueObjectSelect } from '@/layout/shell/actions/shell_issue_object_select.js';
import { LayoutShellPanels, type LayoutShellPanelsDocks } from '@/layout/shell/mount/layout_shell_panels.js';

/** Editor parts the docked panels of the main window are built from. */
export interface LayoutShellPanelsSource extends EntityBrowserPlacementHost {
  /** Docks that receive the panels. */
  readonly docks: LayoutShellPanelsDocks;
  readonly selectionManager: ManagerSelection;
  readonly worldObject: THREE.Group;
  readonly commandStack: CommandStack;
  readonly layerManager: LayerManager;
  readonly statusBar: StatusBar | null;
  /** Face selection and extrusion controller the face inspector edits. */
  readonly faceController: ControllerFaceExtrusion;
  /** Creation callbacks the entity browser entries run. */
  readonly addMenuActions: AddMenuActions;
  /** Grid snap providing UV nudge and rotation steps, or null. */
  readonly gridSnap?: GridSnap | null;
  /** Keyboard handler receiving the face UV shortcuts, or null. */
  readonly keyboardShortcutHandler?: HandlerKeyboardShortcut | null;
  /** Supplies the active viewport camera, or null. */
  readonly activeCameraRead?: (() => THREE.Camera | null) | null;
  /** Shows the Face inspector tab when faces become selected. */
  readonly revealFaceInspector?: (() => void) | null;
  /** Reads whether the Face inspector auto-reveal setting is enabled. */
  readonly isFaceInspectorAutoRevealEnabled?: (() => boolean) | null;
  /** Refreshes viewport shading after face materials changed. */
  surfaceShadingRefresh(): void;
  /** Refreshes the editor after the map content changed. */
  refreshAfterWorldMutation(): void;
  /** Frames the selection in every view. */
  selectionFrameAll(): void;
}

/**
 * Builds and mounts the docked panels of the main window. Activating an issue
 * selects its object and frames it in every view.
 *
 * @param source Editor parts the panels are built from.
 * @returns Mounted panels.
 */
export function layoutShellPanelsCreate(source: LayoutShellPanelsSource): LayoutShellPanels {
  return new LayoutShellPanels({
    docks: source.docks,
    faceInspectorDependencies: faceInspectorDependenciesCreate(source),
    entityBrowserHost: entityBrowserHostCreate(source),
    dockPanels: layoutShellDockPanelsOptionsCreate(source),
  });
}

/**
 * Builds the Face tab services from the shell source.
 *
 * @param source Editor parts the docked panels are built from.
 * @returns Face inspector setup dependencies.
 */
function faceInspectorDependenciesCreate(source: LayoutShellPanelsSource): FaceInspectorSetupDeps {
  return {
    selectionManager: source.selectionManager,
    faceController: source.faceController,
    commandStack: source.commandStack,
    statusBar: source.statusBar,
    afterSurfaceChange: () => source.surfaceShadingRefresh(),
    ...(source.gridSnap !== undefined ? { gridSnap: source.gridSnap } : {}),
    ...(source.keyboardShortcutHandler !== undefined
      ? { keyboardShortcutHandler: source.keyboardShortcutHandler }
      : {}),
    ...(source.activeCameraRead !== undefined ? { activeCameraRead: source.activeCameraRead } : {}),
    ...(source.revealFaceInspector !== undefined ? { revealFaceInspector: source.revealFaceInspector } : {}),
    ...(source.isFaceInspectorAutoRevealEnabled !== undefined
      ? { isFaceInspectorAutoRevealEnabled: source.isFaceInspectorAutoRevealEnabled }
      : {}),
    worldObject: source.worldObject,
  };
}

/**
 * Builds the entity browser host from the shell source.
 *
 * @param source Editor parts the docked panels are built from.
 * @returns Entity browser host.
 */
function entityBrowserHostCreate(source: LayoutShellPanelsSource): EntityBrowserSetupHost {
  return {
    worldObject: source.worldObject,
    addMenuActions: source.addMenuActions,
    viewportAtClientPointResolve: (clientX, clientY) => source.viewportAtClientPointResolve(clientX, clientY),
    spawnCameraOverrideRun: (camera, action) => source.spawnCameraOverrideRun(camera, action),
  };
}

/**
 * Builds the options of the layers panel and the console and issues views.
 *
 * @param source Editor parts the panels are built from.
 * @returns Dock panel options without the docks.
 */
function layoutShellDockPanelsOptionsCreate(
  source: LayoutShellPanelsSource,
): ConstructorParameters<typeof LayoutShellPanels>[0]['dockPanels'] {
  return {
    layerDependencies: {
      layerManager: source.layerManager,
      commandStack: source.commandStack,
      selectionManager: source.selectionManager,
      worldGroup: source.worldObject,
      refresh: () => source.refreshAfterWorldMutation(),
    },
    worldGroup: source.worldObject,
    commandStack: source.commandStack,
    onIssueActivate: (issue) => layoutShellIssueActivate(source, issue),
  };
}

/**
 * Selects the object of an activated issue and frames it in every view.
 *
 * @param source Editor parts with the selection and world.
 * @param issue Activated issue.
 */
function layoutShellIssueActivate(source: LayoutShellPanelsSource, issue: Issue): void {
  if (shellIssueObjectSelect(issue, source.worldObject, source.selectionManager)) {
    source.selectionFrameAll();
  }
}
