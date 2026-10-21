import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { HandlerHierarchyReparent } from '@/outliner/hierarchy/handler_hierarchy_reparent.js';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { PanelOutliner } from '@/outliner/ui/panel_outliner.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import type { OutlinerDropPlacement } from '@/outliner/ui/outliner_drop_placement.js';
import type { ViewportToolChromeDocking } from '@/tools/chrome/host/viewport_tool_chrome_docking.js';
import { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import { ShellInspector } from '@/layout/shell/inspector/shell_inspector.js';
import { ShellInfoPanel } from '@/layout/shell/info_panel/shell_info_panel.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { shellMenuBarPopulate, shellMenusBuiltinCreate } from '@/layout/shell/menubar/shell_menu_bar.js';
import { ShellToolBarBuilder } from '@/layout/shell/toolbar/shell_tool_bar_builder.js';

/** Outliner action callbacks accepted when building the shell. */
export interface EditorShellOutlinerActions {
  onDuplicateFromOutliner: (obj: THREE.Object3D) => void;
  onDeleteFromOutliner: (obj: THREE.Object3D) => void;
  onGroupFromOutliner: (objects: THREE.Object3D[]) => void;
  onUngroupFromOutliner: (group: THREE.Group) => void;
  onRenameFromOutliner: (obj: THREE.Object3D, newName: string) => void;
  onToggleVisibilityFromOutliner: (obj: THREE.Object3D) => void;
  onToggleLockFromOutliner: (obj: THREE.Object3D) => void;
  reparentFromDrop: (
    dragged: THREE.Object3D | readonly THREE.Object3D[],
    target: THREE.Object3D,
    placement: OutlinerDropPlacement,
  ) => void;
  syncViewports: () => void;
  refreshOutliner: () => void;
  showStatusMessage: (message: string) => void;
}

/** Toolbar action callbacks bound when toolbar buttons are created. */
export interface EditorToolbarActions {
  onAddCube: () => void;
  onAddSphere: () => void;
  onAddCylinder: () => void;
  onAddPlane: () => void;
  onAddTerrain: () => void;
  onAddSolidModel: () => void;
  onAddBevelVolume: () => void;
  onAddPointLight: () => void;
  onAddSpotLight: () => void;
  onAddRoom: () => void;
  onAddPortal: () => void;
  /**
   * Adds an entity owner built by a factory at the spawn point as one undoable
   * step and selects it.
   */
  onAddEntityPlaced: (factory: () => THREE.Group, objectRadius: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSolidModelPanel: () => void;
  onToggleSettingsDialog: () => void;
  onOpenDocumentation: () => void;
  onOpenAboutDialog: () => void;
  onOpenMcpDialog: () => void;
  onToggleGamePreviewPanel: () => void;
  onOpenDetachedViewport: () => void;
  onToggleAiCaptureDebugPanel: () => void;
  onToggleAudio: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onCsgUnion: () => void;
  onCsgSubtract: () => void;
  onCsgIntersect: () => void;
  /** True when mesh CSG menu actions apply to the current selection. */
  canRunCsgBoolean: () => boolean;
  onToggleSnap: () => void;
  onSnapIntervalBackward: () => void;
  onSnapIntervalForward: () => void;
  onToggleTextureLock: () => void;
  onTogglePositionLock: () => void;
  onToggleStretchLock: () => void;
  onAlignToOrigin: () => void;
  onAlignToGridCenter: () => void;
  onAlignToObject: () => void;
  onNewScene: () => void;
  onSaveScene: () => void;
  onSaveSceneAs: () => void;
  onLoadScene: () => void;
  onImportVmf: () => void;
  onImportObj: () => void;
  onExportGlb: () => void;
  onExportObj: () => void;
  onExportFbx: () => void;
  onSetTransformSpaceGlobal: () => void;
  onSetTransformSpaceLocal: () => void;
  isUserSnapEnabled: () => boolean;
  isTextureLockEnabled: () => boolean;
  isPositionLockEnabled: () => boolean;
  isStretchLockEnabled: () => boolean;
  isTransformSpaceLocal: () => boolean;
  isAudioEnabled: () => boolean;
}

/** Result of building the main editor shell DOM structure. */
export interface EditorShellElements {
  /** Main window root column; floating panels and dialogs mount here. */
  toolbarContainer: HTMLElement;
  /** Relative host element for the viewport workspace. */
  viewportArea: HTMLElement;
  /** Absolute layer that holds pane chrome containers. */
  viewportPaneGrid: HTMLElement;
  viewports: HTMLElement[];
  /** Main icon toolbar. */
  toolbar: Toolbar;
  /** Slim menu bar of text menus. */
  menuBar: Toolbar;
  outlinerPanel: PanelOutliner;
  propertiesPanel: PanelProperties;
  statusBar: StatusBar;
  /** Main window skeleton with the docks. */
  frame: ShellFrame;
  /** Right-hand Map / Entity / Face inspector. */
  inspector: ShellInspector;
  /** Bottom Console / Issues panel. */
  infoPanel: ShellInfoPanel;
  /** Commands that show, hide and switch the docks. */
  dockCommands: ShellDockCommands;
  /** Parents of the docked tool buttons and tool options. */
  toolChromeDocking: ViewportToolChromeDocking;
}

/** Scene services the shell panels bind to. */
export interface EditorShellServices {
  selectionManager: ManagerSelection;
  worldObject: THREE.Group;
  commandStack: CommandStack;
  gridSnap: GridSnap;
  textureLock: TextureLockSettings;
  hierarchyReparentHandler: HandlerHierarchyReparent;
}

/** Action bundles the shell menus, toolbar and outliner run. */
export interface EditorShellActionBundles {
  outlinerActions: EditorShellOutlinerActions;
  toolbarActions: EditorToolbarActions;
  windowActions: ShellWindowActions;
}

/** Docks and bars created before the panels are mounted. */
interface EditorShellSkeleton {
  frame: ShellFrame;
  inspector: ShellInspector;
  infoPanel: ShellInfoPanel;
  dockCommands: ShellDockCommands;
}

/**
 * Builds the main window in the map editor arrangement: a menu bar, an icon
 * toolbar, the map views with a view bar above and the info panel below, the
 * inspector on the right, and the status bar.
 */
export class BuilderEditorShell {
  /**
   * Builds and appends the full editor shell under the given container.
   *
   * @param editorContainer Root DOM element that receives the shell.
   * @param services Scene services the panels bind to.
   * @param bundles Outliner, toolbar and window actions.
   * @returns Created shell elements and UI components.
   */
  build(
    editorContainer: HTMLElement,
    services: EditorShellServices,
    bundles: EditorShellActionBundles,
  ): EditorShellElements {
    const skeleton = this.skeletonCreate(editorContainer);
    const menuBar = this.menuBarCreate(skeleton, bundles);
    const toolbar = new Toolbar(skeleton.frame.toolbarHostRead());
    const railParent = new ShellToolBarBuilder().build(toolbar, bundles.toolbarActions, bundles.windowActions);
    const viewportShell = this.createViewportShell(skeleton.frame.viewColumnRead());
    return {
      toolbarContainer: skeleton.frame.getElement(),
      viewportArea: viewportShell.host,
      viewportPaneGrid: viewportShell.paneGrid,
      viewports: this.createViewportContainers(viewportShell.paneGrid),
      toolbar,
      menuBar,
      outlinerPanel: this.createOutliner(
        skeleton.inspector.slotRead('map_outliner'),
        services,
        bundles.outlinerActions,
      ),
      propertiesPanel: this.createPropertiesPanel(skeleton.inspector.slotRead('entity_properties'), services),
      statusBar: this.createStatusBar(skeleton.frame.getElement(), services.gridSnap, services.commandStack),
      ...skeleton,
      toolChromeDocking: { railParent, optionsParent: skeleton.frame.viewBarToolSlotRead() },
    };
  }

  /**
   * Creates the main window skeleton and mounts the docks into it.
   *
   * @param editorContainer Root DOM element that receives the shell.
   * @returns Frame, docks and dock commands.
   */
  private skeletonCreate(editorContainer: HTMLElement): EditorShellSkeleton {
    const stateStore = new ShellStateStore();
    const frame = new ShellFrame(editorContainer, stateStore);
    const inspector = new ShellInspector(stateStore);
    const infoPanel = new ShellInfoPanel(stateStore);
    frame.inspectorHostRead().appendChild(inspector.getElement());
    frame.infoPanelHostRead().appendChild(infoPanel.getElement());
    return { frame, inspector, infoPanel, dockCommands: new ShellDockCommands(frame, inspector, infoPanel) };
  }

  /**
   * Creates the menu bar and fills it with the main window menus.
   *
   * @param skeleton Frame and docks.
   * @param bundles Toolbar and window actions the menus run.
   * @returns Menu bar.
   */
  private menuBarCreate(skeleton: EditorShellSkeleton, bundles: EditorShellActionBundles): Toolbar {
    const menuBar = new Toolbar(skeleton.frame.menuBarHostRead(), 'menubar');
    shellMenuBarPopulate(menuBar, shellMenusBuiltinCreate(), {
      toolbarActions: bundles.toolbarActions,
      windowActions: bundles.windowActions,
      dockCommands: skeleton.dockCommands,
    });
    return menuBar;
  }

  /**
   * Creates the viewport workspace host and appends the absolute pane grid
   * overlay under the view column.
   *
   * @param viewColumn Column below the view bar that receives the host.
   * @returns Host element and nested pane grid layer.
   */
  private createViewportShell(viewColumn: HTMLElement): { host: HTMLElement; paneGrid: HTMLElement } {
    const host = this.createViewportHost();
    const paneGrid = this.createViewportPaneGrid();
    host.appendChild(paneGrid);
    viewColumn.appendChild(host);
    return { host, paneGrid };
  }

  /**
   * Creates and styles the relative viewport workspace host element.
   *
   * @returns Viewport workspace host element.
   */
  private createViewportHost(): HTMLElement {
    const host = document.createElement('div');
    host.classList.add('editor-viewport-area');
    host.style.position = 'relative';
    host.style.flex = '1';
    host.style.overflow = 'hidden';
    host.style.minWidth = '0';
    host.style.minHeight = '0';
    host.style.background = `#${Theme.separatorColor.toString(16).padStart(6, '0')}`;
    return host;
  }

  /**
   * Creates and styles the absolute full-inset pane layer element.
   *
   * @returns Pane layer element.
   */
  private createViewportPaneGrid(): HTMLElement {
    const paneGrid = document.createElement('div');
    paneGrid.classList.add('editor-viewport-pane-grid');
    paneGrid.style.position = 'absolute';
    paneGrid.style.inset = '0';
    paneGrid.style.display = 'block';
    paneGrid.style.boxSizing = 'border-box';
    paneGrid.style.zIndex = '1';
    return paneGrid;
  }

  /**
   * Creates seed pane containers for top, front, side, and perspective areas.
   *
   * @param paneGrid Absolute layer that receives the containers.
   * @returns Containers ordered top, front, side, perspective.
   */
  private createViewportContainers(paneGrid: HTMLElement): HTMLElement[] {
    return [
      this.createContainer(paneGrid, 'pane_top'),
      this.createContainer(paneGrid, 'pane_front'),
      this.createContainer(paneGrid, 'pane_side'),
      this.createContainer(paneGrid, 'pane_perspective'),
    ];
  }

  /**
   * Creates a viewport container element for an area id.
   *
   * @param paneGrid Parent pane layer.
   * @param areaId Stable area / pane id.
   * @returns The created container element.
   */
  private createContainer(paneGrid: HTMLElement, areaId: string): HTMLElement {
    const el = document.createElement('div');
    el.dataset['areaId'] = areaId;
    el.classList.add('editor-area-pane');
    el.style.position = 'absolute';
    el.style.overflow = 'hidden';
    el.style.background = 'transparent';
    paneGrid.appendChild(el);
    return el;
  }

  /**
   * Creates the outliner panel filling its inspector slot and registers context
   * callbacks.
   *
   * @param slot Inspector slot that receives the panel.
   * @param services Scene services the panel binds to.
   * @param outlinerActions Outliner action callbacks to register.
   * @returns Configured PanelOutliner.
   */
  private createOutliner(
    slot: HTMLElement,
    services: EditorShellServices,
    outlinerActions: EditorShellOutlinerActions,
  ): PanelOutliner {
    const outlinerPanel = new PanelOutliner(slot, services.selectionManager, services.worldObject);
    this.dockedPanelFill(outlinerPanel.getElement());
    this.outlinerCallbacksBind(outlinerPanel, services.hierarchyReparentHandler, outlinerActions);
    return outlinerPanel;
  }

  /**
   * Registers outliner context, hierarchy and reparent callbacks.
   *
   * @param outlinerPanel Outliner panel.
   * @param hierarchyReparentHandler Reparent drop handler to wire.
   * @param outlinerActions Outliner action callbacks to register.
   */
  private outlinerCallbacksBind(
    outlinerPanel: PanelOutliner,
    hierarchyReparentHandler: HandlerHierarchyReparent,
    outlinerActions: EditorShellOutlinerActions,
  ): void {
    outlinerPanel.setContextCallbacks(
      (mesh) => outlinerActions.onDuplicateFromOutliner(mesh),
      (mesh) => outlinerActions.onDeleteFromOutliner(mesh),
    );
    outlinerPanel.setGroupCallback((objects) => outlinerActions.onGroupFromOutliner(objects));
    outlinerPanel.setUngroupCallback((group) => outlinerActions.onUngroupFromOutliner(group));
    outlinerPanel.setRenameCallback((obj, newName) => outlinerActions.onRenameFromOutliner(obj, newName));
    outlinerPanel.setVisibilityCallback((obj) => outlinerActions.onToggleVisibilityFromOutliner(obj));
    outlinerPanel.setLockCallback((obj) => outlinerActions.onToggleLockFromOutliner(obj));
    hierarchyReparentHandler.setSyncViewports(() => outlinerActions.syncViewports());
    hierarchyReparentHandler.setRefreshOutliner(() => outlinerActions.refreshOutliner());
    hierarchyReparentHandler.setShowStatus((message) => outlinerActions.showStatusMessage(message));
    outlinerPanel.setReparentCallback((dragged, target, placement) =>
      outlinerActions.reparentFromDrop(dragged, target, placement),
    );
  }

  /**
   * Creates the properties panel filling its inspector slot and wires command
   * stack and texture lock.
   *
   * @param slot Inspector slot that receives the panel.
   * @param services Scene services the panel binds to.
   * @returns Configured PanelProperties.
   */
  private createPropertiesPanel(slot: HTMLElement, services: EditorShellServices): PanelProperties {
    const propertiesPanel = new PanelProperties(slot, Theme, services.selectionManager);
    this.dockedPanelFill(propertiesPanel.getContainer());
    propertiesPanel.getContainer().style.overflowY = 'auto';
    propertiesPanel.setCommandStack(services.commandStack);
    propertiesPanel.setTextureLockSettings(services.textureLock);
    return propertiesPanel;
  }

  /**
   * Makes a side panel fill its dock slot instead of keeping a fixed column
   * width.
   *
   * @param panelRoot Root element of the panel.
   */
  private dockedPanelFill(panelRoot: HTMLElement): void {
    panelRoot.style.width = 'auto';
    panelRoot.style.minWidth = '0';
    panelRoot.style.flex = '1 1 auto';
    panelRoot.style.minHeight = '0';
    panelRoot.style.borderLeft = 'none';
  }

  /**
   * Creates the status bar and binds command stack updates to it.
   *
   * @param toolbarContainer Parent flex column.
   * @param gridSnap Snap source for initial status values.
   * @param commandStack Undo stack for count updates.
   * @returns Configured StatusBar.
   */
  private createStatusBar(toolbarContainer: HTMLElement, gridSnap: GridSnap, commandStack: CommandStack): StatusBar {
    const statusBar = new StatusBar(toolbarContainer, Theme);
    statusBar.setUndoRedoCounts(0, 0);
    statusBar.setTransformMode('Bounds');
    statusBar.setSnapInterval(gridSnap.getInterval());
    statusBar.setSnapStatus(gridSnap.isEnabled());
    commandStack.onStackChanged((undoCount, redoCount) => {
      statusBar.setUndoRedoCounts(undoCount, redoCount);
    });
    return statusBar;
  }
}
