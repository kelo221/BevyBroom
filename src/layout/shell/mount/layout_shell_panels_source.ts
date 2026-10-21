import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import type { EntityBrowserPlacementHost } from '@/entity_browser/placement/entity_browser_placement_at_client_point.js';
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
    faceInspectorDependencies: {
      selectionManager: source.selectionManager,
      faceController: source.faceController,
      commandStack: source.commandStack,
      statusBar: source.statusBar,
      afterSurfaceChange: () => source.surfaceShadingRefresh(),
    },
    entityBrowserHost: {
      worldObject: source.worldObject,
      addMenuActions: source.addMenuActions,
      viewportAtClientPointResolve: (clientX, clientY) => source.viewportAtClientPointResolve(clientX, clientY),
      spawnCameraOverrideRun: (camera, action) => source.spawnCameraOverrideRun(camera, action),
    },
    dockPanels: layoutShellDockPanelsOptionsCreate(source),
  });
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
