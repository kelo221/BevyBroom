import type * as THREE from 'three';
import { ViewportLayoutCore } from './viewport_layout_core.js';
import {
  layoutWindowShortcutsDockCreate,
  layoutWindowShortcutsRegister,
  layoutWindowShortcutsWindowActionsCreate,
} from '@/layout/setup/layout_window_shortcut_bindings.js';
import {
  layoutShellPanelsCreate,
  type LayoutShellPanelsSource,
} from '@/layout/shell/mount/layout_shell_panels_source.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { ShellWindowActionsLayout } from '@/layout/shell/actions/shell_window_actions_layout.js';
import {
  LayoutViewportFileActions,
  type LayoutViewportFileActionsContext,
} from '@/layout/viewport/layout_viewport_file_actions.js';
import { LayoutClipboardSystem } from '@/layout/setup/layout_clipboard_setup.js';

/**
 * Viewport layout level that wires the main window shell: File menu actions,
 * window shortcuts, the clipboard and the docked inspector and info panels.
 */
export abstract class ViewportLayoutShellWiring extends ViewportLayoutCore {
  protected readonly fileActions = new LayoutViewportFileActions(() => this.fileActionsContextRead());

  /**
   * Returns the current editor parts the File menu actions use.
   *
   * @returns File actions context.
   */
  private fileActionsContextRead(): LayoutViewportFileActionsContext {
    return {
      toolbarContainer: this.toolbarContainer,
      sceneIOHandler: this.sceneIOHandler,
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      statusBar: this.statusBar,
      solidModelController: this.solidModelController,
      settingsStore: this.settingsStore,
      ensureSettingsSystem: () => this.ensureSettingsSystem(),
      onSceneLoaded: () => this.onSceneLoaded(),
      refreshAfterWorldMutation: () => this.refreshAfterWorldMutation(),
    };
  }

  /**
   * Creates the main window clipboard, which listens to the document's copy,
   * cut and paste events.
   *
   * @returns Clipboard system.
   */
  protected clipboardSystemCreate(): LayoutClipboardSystem {
    const layout = this;
    const source = {
      worldObject: layout.worldObject,
      commandStack: layout.commandStack,
      selectionManager: layout.selectionManager,
      solidModelControllerRead: () => layout.solidModelController,
      editorWindowRead: () => layout.toolEditorSystem?.editorWindow ?? null,
      hierarchyObjectsDelete: (objects: THREE.Object3D[]) => layout.objectActionHandler.deleteHierarchyObjects(objects),
      gridIntervalRead: () => (layout.userSnapEnabled ? layout.snapManager.getInterval() : 0),
      refreshAfterWorldMutation: () => layout.refreshAfterWorldMutation(),
      showStatusMessage: (message: string) => layout.showStatusMessage(message),
    };
    return new LayoutClipboardSystem(source, this.container.ownerDocument);
  }

  /** Binds the window level view, play, selection and dock shortcuts. */
  protected windowShortcutsRegister(): void {
    const windowActions = this.createShellWindowActions();
    layoutWindowShortcutsRegister(
      this.keyboardShortcutHandler,
      layoutWindowShortcutsWindowActionsCreate(windowActions),
    );
    layoutWindowShortcutsRegister(
      this.keyboardShortcutHandler,
      layoutWindowShortcutsDockCreate(this.shellElements.dockCommands),
    );
  }

  /**
   * Builds the main window selection, view, play, tool, grid and clipboard
   * commands.
   *
   * @returns Window actions.
   */
  protected createShellWindowActions(): ShellWindowActions {
    const layout = this;
    return new ShellWindowActionsLayout({
      viewportChromeHostRead: () => layout.getViewportChromeHost(),
      cameraFitCoordinatorRead: () => layout.cameraFitCoordinator,
      toolChromeRead: () => layout.toolsPaletteController,
      playModeStart: () => layout.playerSystem?.playModeStart(),
      shortcutLabelRead: (action) => layout.fileActions.shortcutLabelRead(action),
      clipboardEditCommandsRead: () => layout.clipboardSystem?.editCommands ?? null,
      get selectionManager() {
        return layout.selectionManager;
      },
      get worldObject() {
        return layout.worldObject;
      },
      get snapManager() {
        return layout.snapManager;
      },
    });
  }

  /** Builds and mounts the docked inspector and info panel contents. */
  protected setupShellPanels(): void {
    this.shellPanels = layoutShellPanelsCreate(this.shellPanelsSource());
    const faceInspectorParts = this.shellPanels.faceInspectorParts;
    this.uvEditorController = faceInspectorParts.uvEditorController;
    this.textureBrowserController = faceInspectorParts.textureBrowserController;
    this.textureAssignmentController = faceInspectorParts.textureAssignmentController;
    this.textureAssignmentController.setAfterSolidTextureAssign(() => this.syncPrimitivesToViewports());
  }

  /**
   * Returns the editor parts the docked panels are built from.
   *
   * @returns Docked panels source.
   */
  private shellPanelsSource(): LayoutShellPanelsSource {
    return {
      docks: this.shellElements,
      selectionManager: this.selectionManager,
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      layerManager: this.layerManager,
      statusBar: this.statusBar,
      faceController: this.faceModeCoordinator.getFaceExtrusionController(),
      addMenuActions: this.createToolbarShellActionsBundle(),
      surfaceShadingRefresh: () => this.shadingModeCoordinator?.updateShadingMeshes(),
      refreshAfterWorldMutation: () => this.refreshAfterWorldMutation(),
      selectionFrameAll: () => this.cameraFitCoordinator.onFitAllViewports(),
      viewportAtClientPointResolve: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.resolveInteractiveViewportAtClientPoint(clientX, clientY) ??
        null,
      spawnCameraOverrideRun: (camera, action) => this.primitiveCreationHandler.spawnCameraOverrideRun(camera, action),
    };
  }

  /** Shows the Face tab of the inspector. */
  protected faceInspectorReveal(): void {
    this.shellPanels?.faceInspectorReveal();
  }
}
