import {
  faceInspectorSetup,
  type FaceInspectorSetupDeps,
  type FaceInspectorSetupResult,
} from '@/texture/layout/layout_face_inspector_setup.js';
import { LayoutTextureWindows } from '@/texture/layout/layout_texture_windows.js';
import { entityBrowserSetup, type EntityBrowserSetupHost } from '@/entity_browser/setup/entity_browser_setup.js';
import type { EntityBrowser } from '@/entity_browser/ui/entity_browser.js';
import { levelBrowserSetup, type LevelBrowserSetupHost } from '@/level_browser/setup/level_browser_setup.js';
import type { LevelBrowser } from '@/level_browser/ui/level_browser.js';
import { BrowserWindowSetup } from '@/browser/setup/browser_window_setup.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import {
  ShellDockPanelsMount,
  type ShellDockPanelsMountOptions,
} from '@/layout/shell/mount/shell_dock_panels_mount.js';
import { ShellHammerBarMount, type ShellHammerBarMountOptions } from '@/layout/shell/mount/shell_hammer_bar_mount.js';
import type { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import type { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import type { Issue } from '@/info_panel/issues/issue.js';
import { SprinkleDialogMount } from '@/tools/sprinkle/ui/mount/sprinkle_dialog_mount.js';
import type { DialogSprinkleServices } from '@/tools/sprinkle/ui/dialog_sprinkle.js';
import { PrefabEditorActions, type PrefabEditorActionsHost } from '@/prefab/actions/prefab_editor_actions.js';
import { prefabEditorActionsActive } from '@/prefab/actions/prefab_editor_actions_active.js';

/** Docks of the main window the panels are mounted into. */
export interface LayoutShellPanelsDocks {
  inspector: ShellInspector;
  infoPanel: ShellInfoPanel;
  dockCommands: ShellDockCommands;
  /** Main window root that floating windows mount into. */
  toolbarContainer: HTMLElement;
}

/** Docks and editor services the docked panels are built from. */
export interface LayoutShellPanelsOptions {
  /** Docks that receive the panels. */
  docks: LayoutShellPanelsDocks;
  /** Services of the face inspector. */
  faceInspectorDependencies: FaceInspectorSetupDeps;
  /** Services of the entity browser. */
  entityBrowserHost: EntityBrowserSetupHost;
  /** Services of the level browser. */
  levelBrowserHost: LevelBrowserSetupHost;
  /** Services of the layers panel and the console and issues views. */
  dockPanels: Omit<ShellDockPanelsMountOptions, 'inspector' | 'infoPanel'>;
  /** Services of the Hammer bar sections. */
  hammerBar: Omit<ShellHammerBarMountOptions, 'inspector' | 'objectBarHandlers'>;
  /** Services of the Entity Sprinkle window. */
  sprinkleDialog: DialogSprinkleServices;
  /** Services of the prefab actions the Entity Browser and the Edit menu run. */
  prefabActions: PrefabEditorActionsHost;
}

/**
 * Builds the panels of the main window: the Hammer bar sections and the layers
 * panel in the inspector, the console and issues views in the info panel, and
 * the Browser window (Place, Textures and Levels tabs), Face Edit Sheet and
 * Entity Sprinkle window.
 */
export class LayoutShellPanels {
  /** Face inspector with the controllers that drive it. */
  readonly faceInspectorParts: FaceInspectorSetupResult;
  /** Textures tab, Face Edit Sheet and Replace Textures window. */
  readonly textureWindows: LayoutTextureWindows;
  /** Entity browser shown on the Place tab of the Browser. */
  readonly entityBrowser: EntityBrowser;
  /** Level browser shown on the Levels tab of the Browser. */
  readonly levelBrowser: LevelBrowser;
  /** Browser window with the Place, Textures and Levels tabs. */
  readonly browserWindow: BrowserWindowSetup;
  /** Object Bar, VisGroups and prefab sections of the Hammer bar. */
  readonly hammerBar: ShellHammerBarMount;
  /** Entity Sprinkle window open while the Sprinkle tool is active. */
  readonly sprinkleDialogMount: SprinkleDialogMount;
  readonly prefabActions: PrefabEditorActions;
  private readonly dockPanels: ShellDockPanelsMount;

  /**
   * Creates and mounts every panel.
   *
   * @param options Docks and editor services.
   */
  constructor(options: LayoutShellPanelsOptions) {
    this.faceInspectorParts = faceInspectorSetup(options.faceInspectorDependencies);
    this.prefabActions = new PrefabEditorActions(options.prefabActions);
    prefabEditorActionsActive.write(this.prefabActions);
    this.entityBrowser = entityBrowserSetup(options.entityBrowserHost);
    this.levelBrowser = levelBrowserSetup(options.levelBrowserHost);
    this.browserWindow = new BrowserWindowSetup({
      host: options.docks.toolbarContainer,
      entityBrowser: this.entityBrowser,
      faceInspector: this.faceInspectorParts.faceInspector,
      levelBrowser: this.levelBrowser,
    });
    this.textureWindows = this.textureWindowsCreate(options);
    this.dockPanels = new ShellDockPanelsMount({
      ...options.dockPanels,
      inspector: options.docks.inspector,
      infoPanel: options.docks.infoPanel,
    });
    this.hammerBar = this.hammerBarCreate(options);
    this.sprinkleDialogMount = new SprinkleDialogMount(options.docks.toolbarContainer, options.sprinkleDialog);
    this.floatingWindowsRegister(options.docks.dockCommands);
  }

  /** Opens the Browser on its Textures tab. */
  faceInspectorReveal(): void {
    this.textureWindows.textureBrowserShow();
  }

  /** Opens the Face Edit Sheet. */
  faceEditSheetReveal(): void {
    this.textureWindows.faceEditSheetReveal();
  }

  /** Opens the Browser on its Place tab. */
  entityBrowserReveal(): void {
    this.browserWindow.placeTab.show();
  }

  /**
   * Opens the Browser on its Levels tab.
   *
   * @param isNameFieldFocused True to focus its name field, for naming a new
   *   level.
   */
  levelBrowserReveal(isNameFieldFocused: boolean): void {
    this.browserWindow.levelsReveal(isNameFieldFocused);
  }

  /**
   * Validates the map at once and returns the found issues.
   *
   * @returns Issues of the map.
   */
  issuesValidateNow(): readonly Issue[] {
    return this.dockPanels.issuesValidateNow();
  }

  /** Disposes every panel, floating window and face inspector controller. */
  dispose(): void {
    getStateEntityPlace().browseDelegateWrite(null);
    prefabEditorActionsActive.releaseIfStored(this.prefabActions);
    this.sprinkleDialogMount.dispose();
    this.hammerBar.dispose();
    this.dockPanels.dispose();
    this.textureWindows.dispose();
    this.browserWindow.dispose();
    this.levelBrowser.dispose();
    this.entityBrowser.dispose();
    this.faceInspectorParts.faceInspector.dispose();
    this.faceInspectorParts.textureBrowserController.dispose();
  }

  /**
   * Creates the floating texture windows over the face inspector.
   *
   * @param options Docks and editor services.
   * @returns Texture windows.
   */
  private textureWindowsCreate(options: LayoutShellPanelsOptions): LayoutTextureWindows {
    const faceDependencies = options.faceInspectorDependencies;
    return new LayoutTextureWindows({
      host: options.docks.toolbarContainer,
      textureBrowser: this.browserWindow.texturesTab,
      faceInspectorParts: this.faceInspectorParts,
      commandStack: faceDependencies.commandStack,
      worldObject: options.hammerBar.worldObject,
      selectionManager: faceDependencies.selectionManager,
      statusBar: faceDependencies.statusBar,
      afterSurfaceChange: () => faceDependencies.afterSurfaceChange(),
    });
  }

  /**
   * Mounts the Hammer bar sections whose Current texture row opens the texture
   * windows.
   *
   * @param options Docks and editor services.
   * @returns Hammer bar sections.
   */
  private hammerBarCreate(options: LayoutShellPanelsOptions): ShellHammerBarMount {
    const hammerBar = new ShellHammerBarMount({
      ...options.hammerBar,
      inspector: options.docks.inspector,
      objectBarHandlers: {
        textureBrowse: () => this.faceInspectorReveal(),
        textureReplace: (textureId) => this.textureWindows.textureReplaceOpen(textureId),
        textureDescribe: (textureId) => this.faceInspectorParts.materialDescribe(textureId),
      },
    });
    this.textureWindows.textureBrowser.openChangeListenerAdd(() => hammerBar.objectBar.textureRefresh());
    return hammerBar;
  }

  /**
   * Registers the Browser tabs with the View menu commands and the Entity tool
   * Browse button.
   *
   * @param dockCommands Commands the View menu runs.
   */
  private floatingWindowsRegister(dockCommands: ShellDockCommands): void {
    dockCommands.floatingWindowRegister('texture_browser', this.browserWindow.texturesTab);
    dockCommands.floatingWindowRegister('entity_browser', this.browserWindow.placeTab);
    dockCommands.floatingWindowRegister('level_browser', this.browserWindow.levelsTab);
    getStateEntityPlace().browseDelegateWrite(() => this.entityBrowserReveal());
  }
}
