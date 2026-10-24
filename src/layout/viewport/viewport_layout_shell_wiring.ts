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
import {
  ShellWindowActionsLayout,
  type ShellWindowActionsLayoutSource,
} from '@/layout/shell/actions/shell_window_actions_layout.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import {
  LayoutViewportFileActions,
  type LayoutViewportFileActionsContext,
} from '@/layout/viewport/layout_viewport_file_actions.js';
import {
  HandlerSolidBrushTools,
  type HandlerSolidBrushToolsDeps,
} from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import { LayoutClipboardSystem } from '@/layout/setup/layout_clipboard_setup.js';
import { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';

/**
 * Viewport layout level that wires the main window shell: File menu actions,
 * window shortcuts, the clipboard and the docked inspector and info panels.
 */
export abstract class ViewportLayoutShellWiring extends ViewportLayoutCore {
  protected readonly fileActions = new LayoutViewportFileActions(() => this.fileActionsContextRead());
  private solidBrushTools: HandlerSolidBrushTools | null = null;
  private selectionVisibility: HandlerSelectionVisibility | null = null;
  protected sceneRecovery: SystemSceneRecovery | null = null;

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
      sceneRecoveryRead: () => this.sceneRecovery,
    };
  }

  /**
   * Starts protecting unsaved work and offers work kept from an earlier
   * session.
   */
  protected setupSceneRecovery(): void {
    this.sceneRecovery = new SystemSceneRecovery({
      host: this.toolbarContainer,
      commandStack: this.commandStack,
      worldObject: this.worldObject,
      sceneIOHandler: this.sceneIOHandler,
      statusBar: this.statusBar,
      onSceneLoaded: () => this.onSceneLoaded(),
    });
    const sceneRecovery = this.sceneRecovery;
    queueMicrotask(() => void sceneRecovery.restoreOffer());
  }

  /** Stops protecting unsaved work. */
  protected sceneRecoveryDispose(): void {
    this.sceneRecovery?.dispose();
    this.sceneRecovery = null;
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
    return new ShellWindowActionsLayout(
      Object.assign(this.shellWindowActionsScenePartsCreate(), {
        viewportChromeHostRead: () => layout.getViewportChromeHost(),
        cameraFitCoordinatorRead: () => layout.cameraFitCoordinator,
        toolChromeRead: () => layout.toolsPaletteController,
        playModeStart: () => layout.playerSystem?.playModeStart(),
        shortcutLabelRead: (action: KeyboardShortcutAction) => layout.fileActions.shortcutLabelRead(action),
        clipboardEditCommandsRead: () => layout.clipboardSystem?.editCommands ?? null,
        solidBrushToolsRead: () => layout.solidBrushToolsEnsure(),
        selectionVisibilityRead: () => layout.selectionVisibilityEnsure(),
      }),
    );
  }

  /**
   * Builds the late-bound scene parts the window actions read on every call.
   *
   * @returns Selection, scene root and grid size getters.
   */
  private shellWindowActionsScenePartsCreate(): Pick<
    ShellWindowActionsLayoutSource,
    'selectionManager' | 'worldObject' | 'snapManager'
  > {
    const layout = this;
    return {
      /** @returns The object selection. */
      get selectionManager() {
        return layout.selectionManager;
      },
      /** @returns The scene root. */
      get worldObject() {
        return layout.worldObject;
      },
      /** @returns The grid size source. */
      get snapManager() {
        return layout.snapManager;
      },
    };
  }

  /**
   * Returns the solid brush tools, creating them on first use.
   *
   * @returns Brush tools bound to this layout.
   */
  protected solidBrushToolsEnsure(): HandlerSolidBrushTools {
    this.solidBrushTools ??= new HandlerSolidBrushTools(this.solidBrushToolsDepsRead());
    return this.solidBrushTools;
  }

  /**
   * Returns the Hide, Isolate and Show All commands, creating them on first
   * use.
   *
   * @returns Visibility commands bound to this layout.
   */
  protected selectionVisibilityEnsure(): HandlerSelectionVisibility {
    this.selectionVisibility ??= new HandlerSelectionVisibility({
      commandStack: this.commandStack,
      selectionManager: this.selectionManager,
      worldObject: this.worldObject,
      afterVisibilityChange: () => this.refreshAfterWorldMutation(),
    });
    return this.selectionVisibility;
  }

  /**
   * Reads the editor services the solid brush tools act on.
   *
   * @returns Brush tools dependencies.
   */
  private solidBrushToolsDepsRead(): HandlerSolidBrushToolsDeps {
    return {
      commandStack: this.commandStack,
      gridSnap: this.gridSnap,
      selectedObjectsRead: () => this.selectionManager.getAllSelectedObjectsAsArray(),
      selectedFacesRead: () => this.faceModeSelectedFacesRead(),
      activeCameraRead: () => this.getActiveSpawnCamera(),
      isTexturePositionLockEnabled: () => this.textureLock.isPositionLocked(),
      showStatusMessage: (message) => this.showStatusMessage(message),
      selectionReplace: (meshes) => this.selectionManager.setSelection([...meshes]),
      afterWorldMutation: () => this.refreshAfterWorldMutation(),
    };
  }

  /**
   * Returns the selected faces while face mode is active.
   *
   * @returns Selected faces, empty in object mode.
   */
  private faceModeSelectedFacesRead(): FaceSelection[] {
    const faceController = this.faceModeCoordinator.getFaceExtrusionController();
    return faceController.getSelectionMode() === SelectionMode.FACE ? faceController.getSelectedFaces() : [];
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
      ...this.faceInspectorSourcePartsRead(),
      viewportAtClientPointResolve: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.resolveInteractiveViewportAtClientPoint(clientX, clientY) ??
        null,
      spawnCameraOverrideRun: (camera, action) => this.primitiveCreationHandler.spawnCameraOverrideRun(camera, action),
    };
  }

  /**
   * Reads the editor parts the Face tab services need.
   *
   * @returns Face inspector source parts.
   */
  private faceInspectorSourcePartsRead(): Pick<
    LayoutShellPanelsSource,
    | 'gridSnap'
    | 'keyboardShortcutHandler'
    | 'activeCameraRead'
    | 'revealFaceInspector'
    | 'isFaceInspectorAutoRevealEnabled'
  > {
    return {
      gridSnap: this.gridSnap,
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      activeCameraRead: () => this.getActiveSpawnCamera(),
      revealFaceInspector: () => this.faceInspectorReveal(),
      isFaceInspectorAutoRevealEnabled: () => this.settingsStore?.getViewSettings().faceInspectorAutoReveal !== false,
    };
  }

  /** Shows the Face tab of the inspector. */
  protected faceInspectorReveal(): void {
    this.shellPanels?.faceInspectorReveal();
  }
}
