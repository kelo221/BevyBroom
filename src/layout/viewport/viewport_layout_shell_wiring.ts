import type * as THREE from 'three';
import { ViewportLayoutCoordinators } from './viewport_layout_coordinators.js';
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
  LayoutViewportProjectLevelActions,
  type LayoutViewportProjectLevelActionsContext,
} from '@/layout/viewport/layout_viewport_project_level_actions.js';
import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import {
  HandlerSolidBrushTools,
  type HandlerSolidBrushToolsDeps,
} from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import { LayoutClipboardSystem } from '@/layout/setup/layout_clipboard_setup.js';
import { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import { DialogObjectProperties } from '@/ui/object_properties/dialog_object_properties.js';
import { ObjectSelectDoubleClickProperties } from '@/tools/object_select/object_select_double_click_properties.js';
import { ObjectSelectDoubleClickNativeListener } from '@/tools/object_select/object_select_double_click_native_listener.js';
import { objectSelectDoubleClickToolReady } from '@/tools/object_select/object_select_double_click_tool_ready.js';
import { FaceEditObjectShiftClick } from '@/tools/face/object_shift_click/face_edit_object_shift_click.js';
import { EditorToolId } from '@/types/editor_tool_id.js';

/**
 * Viewport layout level that wires the main window shell: File menu actions,
 * window shortcuts, the clipboard and the docked inspector and info panels.
 */
export abstract class ViewportLayoutShellWiring extends ViewportLayoutCoordinators {
  protected readonly fileActions = new LayoutViewportFileActions(() => this.fileActionsContextRead());
  protected readonly projectLevelActions = new LayoutViewportProjectLevelActions(() =>
    this.projectLevelActionsContextRead(),
  );
  private solidBrushTools: HandlerSolidBrushTools | null = null;
  private selectionVisibility: HandlerSelectionVisibility | null = null;
  private objectPropertiesDialog: DialogObjectProperties | null = null;
  private objectSelectDoubleClickNativeListener: ObjectSelectDoubleClickNativeListener | null = null;
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
      projectLevelActionsRead: () => this.projectLevelActions,
    };
  }

  /**
   * Returns the current editor parts the project level actions use.
   *
   * @returns Project level actions context.
   */
  private projectLevelActionsContextRead(): LayoutViewportProjectLevelActionsContext {
    return {
      toolbarContainer: this.toolbarContainer,
      sceneIOHandler: this.sceneIOHandler,
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      statusBar: this.statusBar,
      solidModelController: this.solidModelController,
      serviceRead: () => this.gamePreviewLayoutEnsure().projectLevelServiceEnsure(),
      onSceneLoaded: () => this.onSceneLoaded(),
      sceneRecoveryRead: () => this.sceneRecovery,
      levelBrowserReveal: (isNameFieldFocused) => this.shellPanels?.levelBrowserReveal(isNameFieldFocused),
    };
  }

  /**
   * Returns the actions on the open project's levels.
   *
   * @returns Project level actions.
   */
  protected projectLevelActionsRead(): ProjectLevelActions {
    return this.projectLevelActions;
  }

  /**
   * Replaces the open scene with scene file text as Load does; the scene then
   * belongs to no project level.
   *
   * @param sceneJson Scene file text.
   * @returns True when the scene loaded.
   */
  protected override sceneDocumentTextLoad(sceneJson: string): boolean {
    const isLoaded = super.sceneDocumentTextLoad(sceneJson);
    if (isLoaded) {
      this.projectLevelActions.serviceRead().openLevelForget();
    }
    return isLoaded;
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
        shortcutBindingRead: (action: KeyboardShortcutAction) => layout.fileActions.shortcutBindingRead(action),
        clipboardEditCommandsRead: () => layout.clipboardSystem?.editCommands ?? null,
        solidBrushToolsRead: () => layout.solidBrushToolsEnsure(),
        selectionVisibilityRead: () => layout.selectionVisibilityEnsure(),
        objectPropertiesOpen: () => layout.objectPropertiesOpen(),
      }),
    );
  }

  /** Opens the Object Properties dialog on the current selection. */
  protected objectPropertiesOpen(): void {
    this.objectPropertiesDialogEnsure().open();
  }

  /**
   * Builds the object tool double-click handling that opens Object Properties
   * on the object under the pointer, and forwards the window's browser
   * double-clicks to it.
   *
   * @returns Double-click handling bound to this layout.
   */
  protected objectSelectDoubleClickCreate(): ObjectSelectDoubleClickProperties {
    const objectSelectDoubleClick = new ObjectSelectDoubleClickProperties({
      selectionManager: this.selectionManager,
      pickObjectStackAtClientPoint: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.pickObjectStackAtClientPoint(clientX, clientY) ?? [],
      objectPropertiesOpen: () => this.objectPropertiesOpen(),
      isDoubleClickAllowed: () => this.objectSelectDoubleClickAllowed(),
    });
    this.objectSelectDoubleClickNativeListener?.dispose();
    this.objectSelectDoubleClickNativeListener = new ObjectSelectDoubleClickNativeListener(
      this.container.ownerDocument,
      objectSelectDoubleClick,
    );
    return objectSelectDoubleClick;
  }

  /**
   * Returns whether an idle object tool owns the viewport clicks outside edit
   * mode.
   *
   * @returns True when object double-clicks may open Object Properties.
   */
  private objectSelectDoubleClickAllowed(): boolean {
    return (
      this.editModeCoordinator?.isActive() !== true &&
      objectSelectDoubleClickToolReady(this.toolEditorSystem?.editorWindow.activeTool)
    );
  }

  /**
   * Builds the object tool Shift+click handling that opens the Face tool on the
   * brush face under the pointer.
   *
   * @returns Shift+click face editing bound to this layout.
   */
  protected objectShiftClickFaceEditCreate(): FaceEditObjectShiftClick {
    return new FaceEditObjectShiftClick({
      faceModeCoordinatorRead: () => this.faceModeCoordinator ?? null,
      pickObjectStackAtClientPoint: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.pickObjectStackAtClientPoint(clientX, clientY) ?? [],
      viewportAtClientPointResolve: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.resolveInteractiveViewportAtClientPoint(clientX, clientY) ??
        null,
      isShiftClickFaceEditAllowed: () => this.objectShiftClickFaceEditAllowed(),
      faceToolActivate: () => this.toolsPaletteController?.selectTool(EditorToolId.FACE),
    });
  }

  /**
   * Returns whether the object select tool owns the viewport clicks outside
   * edit mode.
   *
   * @returns True when a Shift+click on a brush face may open the Face tool.
   */
  private objectShiftClickFaceEditAllowed(): boolean {
    return (
      this.editModeCoordinator?.isActive() !== true &&
      this.toolsPaletteController?.getActiveTool() === EditorToolId.OBJECT
    );
  }

  /** Stops forwarding the browser's double-clicks to the object tool. */
  protected objectSelectDoubleClickDispose(): void {
    this.objectSelectDoubleClickNativeListener?.dispose();
    this.objectSelectDoubleClickNativeListener = null;
  }

  /**
   * Returns the Object Properties dialog, creating it on first use.
   *
   * @returns Dialog bound to this layout.
   */
  protected objectPropertiesDialogEnsure(): DialogObjectProperties {
    if (!this.objectPropertiesDialog) {
      this.objectPropertiesDialog = new DialogObjectProperties(this.toolbarContainer, {
        selectionManager: this.selectionManager,
        commandStack: this.commandStack,
        worldObject: this.worldObject,
        afterWorldMutation: () => this.refreshAfterWorldMutation(),
        afterTransformCommit: (objects) => this.refreshVisualsAfterTransformCommit(objects),
        propertiesPanelRead: () => this.propertiesPanel,
        selectionFrame: () => this.cameraFitCoordinator.onFitToSelection(),
      });
      this.objectPropertiesDialog.setDefaultAnchor(this.viewportArea);
    }
    return this.objectPropertiesDialog;
  }

  /** Cancels and removes the Object Properties dialog when it exists. */
  protected objectPropertiesDialogDispose(): void {
    this.objectPropertiesDialog?.dispose();
    this.objectPropertiesDialog = null;
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
      projectLevelActions: this.projectLevelActions,
      surfaceShadingRefresh: () => this.shadingModeCoordinator?.updateShadingMeshes(),
      refreshAfterWorldMutation: () => this.refreshAfterWorldMutation(),
      selectionFrameAll: () => this.cameraFitCoordinator.onFitAllViewports(),
      toolSelect: (toolId) => this.toolsPaletteController?.selectTool(toolId),
      ...this.faceInspectorSourcePartsRead(),
      viewportAtClientPointResolve: (clientX, clientY) =>
        this.toolEditorSystem?.editorWindow.getServices()?.resolveInteractiveViewportAtClientPoint(clientX, clientY) ??
        null,
      spawnCameraOverrideRun: (camera, action) => this.primitiveCreationHandler.spawnCameraOverrideRun(camera, action),
    };
  }

  /**
   * Reads the editor parts the face inspector services need.
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
      revealFaceInspector: () => this.faceEditSheetReveal(),
      isFaceInspectorAutoRevealEnabled: () => this.settingsStore?.getViewSettings().faceInspectorAutoReveal !== false,
    };
  }

  /** Opens the floating texture browser holding the face inspector. */
  protected faceInspectorReveal(): void {
    this.shellPanels?.faceInspectorReveal();
  }

  /** Opens the Face Edit Sheet. */
  protected faceEditSheetReveal(): void {
    this.shellPanels?.faceEditSheetReveal();
  }
}
