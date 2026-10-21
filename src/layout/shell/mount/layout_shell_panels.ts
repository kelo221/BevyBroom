import {
  faceInspectorSetup,
  type FaceInspectorSetupDeps,
  type FaceInspectorSetupResult,
} from '@/texture/layout/layout_face_inspector_setup.js';
import { entityBrowserSetup, type EntityBrowserSetupHost } from '@/entity_browser/setup/entity_browser_setup.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import {
  ShellDockPanelsMount,
  type ShellDockPanelsMountOptions,
} from '@/layout/shell/mount/shell_dock_panels_mount.js';
import type { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import type { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import type { Issue } from '@/info_panel/issues/issue.js';

/** Docks of the main window the panels are mounted into. */
export interface LayoutShellPanelsDocks {
  inspector: ShellInspector;
  infoPanel: ShellInfoPanel;
  dockCommands: ShellDockCommands;
}

/** Docks and editor services the docked panels are built from. */
export interface LayoutShellPanelsOptions {
  /** Docks that receive the panels. */
  docks: LayoutShellPanelsDocks;
  /** Services of the Face tab. */
  faceInspectorDependencies: FaceInspectorSetupDeps;
  /** Services of the entity browser. */
  entityBrowserHost: EntityBrowserSetupHost;
  /** Services of the layers panel and the console and issues views. */
  dockPanels: Omit<ShellDockPanelsMountOptions, 'inspector' | 'infoPanel'>;
}

/**
 * Builds the docked panels of the main window: the face inspector in the Face
 * tab, the entity browser under the properties, the layers panel above the
 * outliner and the console and issues views in the info panel.
 */
export class LayoutShellPanels {
  /** Face inspector with the controllers that drive it. */
  readonly faceInspectorParts: FaceInspectorSetupResult;
  /** Entity browser of the Entity tab. */
  readonly entityBrowser: EntityBrowser;
  private readonly dockPanels: ShellDockPanelsMount;
  private readonly docks: LayoutShellPanelsDocks;

  /**
   * Creates and mounts every docked panel.
   *
   * @param options Docks and editor services.
   */
  constructor(options: LayoutShellPanelsOptions) {
    this.docks = options.docks;
    this.faceInspectorParts = faceInspectorSetup(options.faceInspectorDependencies);
    this.entityBrowser = entityBrowserSetup(options.entityBrowserHost);
    this.dockPanels = new ShellDockPanelsMount({
      ...options.dockPanels,
      inspector: options.docks.inspector,
      infoPanel: options.docks.infoPanel,
    });
    this.inspectorSlotsFill();
    this.faceInspectorVisibilityFollowTab();
  }

  /** Shows the Face tab of the inspector. */
  faceInspectorReveal(): void {
    this.docks.dockCommands.inspectorTabReveal('face');
  }

  /**
   * Validates the map at once and returns the found issues.
   *
   * @returns Issues of the map.
   */
  issuesValidateNow(): readonly Issue[] {
    return this.dockPanels.issuesValidateNow();
  }

  /** Disposes every docked panel and the face inspector controllers. */
  dispose(): void {
    this.dockPanels.dispose();
    this.entityBrowser.dispose();
    this.faceInspectorParts.faceInspector.dispose();
    this.faceInspectorParts.textureBrowserController.dispose();
  }

  /** Appends the face inspector and the entity browser to their inspector slots. */
  private inspectorSlotsFill(): void {
    this.docks.inspector.slotRead('face').appendChild(this.faceInspectorParts.faceInspector.getElement());
    this.docks.inspector.slotRead('entity_browser').appendChild(this.entityBrowser.getElement());
  }

  /** Keeps the face inspector refreshing only while the Face tab is shown. */
  private faceInspectorVisibilityFollowTab(): void {
    const faceInspector = this.faceInspectorParts.faceInspector;
    faceInspector.setVisible(this.docks.inspector.activeTabIdRead() === 'face');
    this.docks.inspector.tabChangeListenerAdd((tabId) => faceInspector.setVisible(tabId === 'face'));
  }
}
