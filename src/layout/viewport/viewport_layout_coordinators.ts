import * as THREE from 'three';
import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { ControllerSelectionVisual } from '@/selection/object/controller_selection_visual.js';
import { HandlerPrimitiveCreation } from '@/tools/creation/handler_primitive_creation.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import {
  setupCameraAndShadingCoordinators as createCameraAndShadingCoordinators,
  setupFaceModeCoordinator as createFaceModeCoordinator,
  setupToolsPaletteAndClipWiring as createToolsPaletteAndClip,
  cancelClipToolSelection,
  refreshViewportToolChrome,
} from '@/layout/setup/layout_coordinator_setup.js';
import { CoordinatorEditorOrientation } from '@/navigation/orientation/coordinator_editor_orientation.js';
import type { EditorOrientation } from '@/navigation/orientation/editor_orientation.js';
import { HandlerGridOrientation } from '@/tools/grid/handler_grid_orientation.js';
import { TransformMode } from '@/types/transform_mode.js';
import type { ObjectApplyTransformKind } from '@/types/object_apply_transform_kind.js';
import { HandlerObjectApplyTransform } from '@/transform/apply/handler_object_apply_transform.js';
import { HandlerSolidBrushHull } from '@/tools/hull/handler_solid_brush_hull.js';
import { hullBrushSelectionFinish } from '@/tools/hull/hull_brush_selection_finish.js';
import { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';
import { EditorOverlayId } from '@/tools/overlay/editor_overlay_id.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { ManagerProjectedGrid } from '@/viewports/grid/projected/manager_projected_grid.js';
import { createWiredActionHandlers } from '@/layout/setup/factory_layout_action_handler.js';
import { audioSettings } from '@/audio/settings/audio_settings.js';
import { audioContextHost } from '@/audio/context/audio_context_host.js';
import { ShellMainWindowControl } from '@/layout/shell/actions/shell_main_window_control.js';
import { setupSolidModelLayout } from '@/solid/layout/solid_model_layout_setup.js';
import { setupPlayerLayout } from '@/player/player_layout_setup.js';
import { setupLayoutAi } from '@/layout/setup/layout_ai_setup.js';
import { PanelAiCaptureDebug } from '@/ai/client/ui/panel_ai_capture_debug.js';
import {
  createLayoutSnapSettingsController,
  openLayoutDetachedViewport,
  openLayoutDocumentation,
  openLayoutMcpDialog,
  toggleLayoutSolidModelPanel,
} from '@/layout/setup/layout_toolbar_actions.js';
import {
  createLayoutSettingsDialog,
  createLayoutSettingsSystem,
  openLayoutAboutDialog,
} from '@/layout/setup/layout_settings_system.js';
import { LayoutGamePreview } from '@/preview/layout/layout_game_preview.js';
import { ViewportLayoutCore } from './viewport_layout_core.js';

/**
 * Viewport layout level that wires handlers, coordinators, tool chrome,
 * solid models, player, AI and settings after the shell and viewports exist.
 */
export abstract class ViewportLayoutCoordinators extends ViewportLayoutCore {
  /** Wires specialized handlers after viewports and shell exist. */
  protected override wireHandlersAndCoordinators(): void {
    this.createSelectionAndPrimitiveHandlers();
    this.createActionHandlers();
    this.refreshOutliner();
    this.wireSelectionSystem();
    this.setupTransformSystem();
    this.ensureSettingsSystem();
    this.setupKeyboardShortcuts();
    this.sceneIOHandler = new HandlerSceneIo();
    this.setupCameraAndShadingCoordinators();
    this.setupFaceModeCoordinator();
    this.setupShellPanels();
    this.setupToolsPaletteAndClip();
    this.setupSolidModelPanel();
    this.setupPlayerSystem();
    this.setupAiBridge();
    this.setupSnapSettingsController();
    this.installToolEditorFocusSystem();
    this.setupSceneRecovery();
  }

  /**
   * Registers floating tool windows and installs capture-phase focus routing
   * (Shape Editor active event receiver + busy exclusivity for GUI).
   */
  protected installToolEditorFocusSystem(): void {
    if (!this.toolEditorSystem) {
      return;
    }

    this.registerToolEditorGuiSurface(this.solidModelPanel, 'solid_model_panel');
    this.registerToolEditorGuiSurface(this.aiCaptureDebugPanel, 'ai_capture_debug_panel');
    this.toolEditorSystem.installFocusPointerRouter(this.toolbarContainer);
  }

  /**
   * Registers a floating panel root with the tool focus manager.
   *
   * @param panel Panel exposing a root element, or null when not built.
   * @param surfaceId Stable surface id for the focus registry.
   */
  protected registerToolEditorGuiSurface(
    panel:
      | {
          getRootElement(): HTMLElement;
          getInteractionRootElement?: () => HTMLElement;
        }
      | null
      | undefined,
    surfaceId: string,
  ): void {
    if (!panel || !this.toolEditorSystem) {
      return;
    }
    const interactionRoot =
      typeof panel.getInteractionRootElement === 'function'
        ? panel.getInteractionRootElement()
        : panel.getRootElement();
    this.toolEditorSystem.registerGuiSurface(interactionRoot, surfaceId);
  }

  /** Creates selection visuals and primitive creation wiring. */
  protected createSelectionAndPrimitiveHandlers(): void {
    this.selectionVisualController = new ControllerSelectionVisual(this.selectionManager, this.viewportSyncManager);
    this.primitiveCreationHandler = new HandlerPrimitiveCreation(
      this.primitiveTool,
      this.worldObject,
      this.commandStack,
      this.selectionManager,
    );
    this.primitiveCreationHandler.setOnPrimitiveCreated(() => this.onPrimitiveCreated());
    this.primitiveCreationHandler.setActiveCameraProvider(() => this.getActiveSpawnCamera());
    this.primitiveCreationHandler.setGridIntervalProvider(() => this.gridSnap.getInterval());
  }

  /**
   * Returns the camera from the active viewport for object spawn placement.
   *
   * @returns Active viewport camera, falling back to the 3D camera.
   */
  protected getActiveSpawnCamera(): THREE.Camera {
    const coordinator = this.shadingModeCoordinator;
    if (coordinator) {
      const viewport = coordinator.getOrderedViewports()[coordinator.getActiveViewportIndex()];
      if (viewport) return viewport.getCamera();
    }
    return (
      this.getActiveViewports()[0]?.getCamera() ??
      this.viewport3D?.getCamera() ??
      this.getAllLiveViewports()[0]!.getCamera()
    );
  }

  /** Creates object, CSG, and alignment action handlers. */
  protected createActionHandlers(): void {
    const handlers = createWiredActionHandlers(
      this.worldObject,
      this.commandStack,
      this.selectionManager,
      this.gridSnap,
      {
        syncViewports: () => this.refreshAfterWorldMutation(),
        afterTransformCommit: (objects) => this.refreshVisualsAfterTransformCommit(objects),
        refreshOutliner: () => this.refreshOutliner(),
        mirrorExpandState: (sourceRoot, cloneRoot) =>
          this.outlinerPanel.copyExpandStateFromSource(sourceRoot, cloneRoot),
        showStatusMessage: (message) => this.showStatusMessage(message),
        onAxisRestrictionChanged: (axis) => this.onAxisRestrictionChanged(axis),
        statusBar: this.statusBar,
      },
    );
    this.objectActionHandler = handlers.objectActionHandler;
    this.csgActionHandler = handlers.csgActionHandler;
    this.alignmentHandler = handlers.alignmentHandler;
  }

  /** Creates camera fit and shading coordinators and binds their controls. */
  protected setupCameraAndShadingCoordinators(): void {
    const setup = createCameraAndShadingCoordinators({
      selectionManager: this.selectionManager,
      statusBar: this.statusBar,
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      getViewports: () => this.getAllLiveViewports(),
      getViewportElements: () => this.viewportRegistry.getContainers(),
      selectionVisualController: this.selectionVisualController,
      getDetachedViewports: () => this.detachedViewportWindow.getViewports(),
    });
    this.cameraFitCoordinator = setup.cameraFitCoordinator;
    this.shadingModeCoordinator = setup.shadingModeCoordinator;
    this.setupViewportMaximizeControls();
    this.setupViewportTypeMenus();
  }


  /**
   * Opens the Face Edit Sheet when face mode starts and the auto-reveal setting
   * allows it.
   */
  protected faceInspectorAutoRevealOnFaceMode(): void {
    if (this.faceModeCoordinator.getSelectionMode() !== SelectionMode.FACE) {
      return;
    }
    if (this.settingsStore?.getViewSettings().faceInspectorAutoReveal !== false) {
      this.faceEditSheetReveal();
    }
  }

  /** Creates the face selection/extrusion coordinator. */
  protected setupFaceModeCoordinator(): void {
    this.faceModeCoordinator = createFaceModeCoordinator({
      getViewports: () => this.getAllInteractiveViewports(),
      getPrimaryScene: () => this.getPrimaryScene(),
      commandStack: this.commandStack,
      gridSnap: this.gridSnap,
      worldObject: this.worldObject,
      selectionManager: this.selectionManager,
      statusBar: this.statusBar,
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      showStatusMessage: (message) => this.showStatusMessage(message),
      syncPrimitivesToViewports: () => this.syncPrimitivesToViewports(),
      updateShadingMeshes: () => this.shadingModeCoordinator.updateShadingMeshes(),
      refreshOutliner: () => this.refreshOutliner(),
      onSelectionModeUiChanged: () => {
        this.toolsPaletteController?.onExternalSelectionModeChanged(this.faceModeCoordinator.getSelectionMode());
        this.updateGizmoVisibility();
        this.updateGizmoPivot();
        this.faceInspectorAutoRevealOnFaceMode();
      },
    });
    this.wireOutlinerFaceModeSelection();
    this.wireEditModeOutlinerAndDeleteGuards();
  }

  /**
   * Routes outliner hierarchy picks into face selection while face mode is
   * active so Shift/Ctrl match viewport face paint and object selection stays
   * empty.
   */
  private wireOutlinerFaceModeSelection(): void {
    this.outlinerPanel.setFaceModeSelectionHandler((hierarchyObject, isShiftPressed, isCtrlPressed) =>
      this.faceModeCoordinator.applyOutlinerHierarchyFaceSelection(hierarchyObject, isShiftPressed, isCtrlPressed),
    );
  }

  /**
   * Installs the central object-selection lock for Edit Mode (all selection
   * mutators refuse) and delete protection for domain objects.
   */
  private wireEditModeOutlinerAndDeleteGuards(): void {
    this.selectionManager.setSelectionChangeLockGuard(
      () => this.editModeCoordinator?.isObjectSelectionChangeBlocked() === true,
      () => this.showStatusMessage('Cannot change object selection while in Edit Mode'),
    );
    this.objectActionHandler.setDeleteProtectionGuard(
      (object) => this.editModeCoordinator?.isObjectDeleteProtected(object) === true,
    );
  }

  /** Creates per-viewport tool chrome, clip plane tool, and related wiring. */
  protected setupToolsPaletteAndClip(): void {
    this.editModeCoordinator = new CoordinatorEditMode({
      getPrimaryScene: () => this.getPrimaryScene(),
      getSelectedObjects: () => this.selectionManager.getAllSelectedObjectsAsArray(),
      getViewports: () => this.getAllInteractiveViewports(),
      showStatusMessage: (message) => this.showStatusMessage(message),
      getCommandStack: () => this.commandStack,
    });
    this.editorOrientationCoordinator = new CoordinatorEditorOrientation({
      getViewports: () => this.getAllLiveViewports(),
      showStatusMessage: (message) => this.showStatusMessage(message),
    });
    this.editorOrientationCoordinator.bindViewports();
    this.bindGridSnapToGridOrientation();
    this.gridOrientationHandler = new HandlerGridOrientation({
      worldObject: this.worldObject,
      orientationCoordinator: this.editorOrientationCoordinator,
      getViewports: () => this.getAllInteractiveViewports(),
      getPrimaryScene: () => this.getPrimaryScene(),
      showStatusMessage: (message) => this.showStatusMessage(message),
      onPickModeChanged: (mode) => this.toolsPaletteController?.setActiveGridPickMode(mode),
      isShiftPressed: () => this.toolEditorSystem?.editorWindow.getServices()?.isShiftPressed() === true,
    });
    const result = createToolsPaletteAndClip({
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      selectionManager: this.selectionManager,
      gridSnap: this.gridSnap,
      clipPlaneTool: this.clipPlaneTool,
      faceModeCoordinator: this.faceModeCoordinator,
      toolChromeDocking: this.shellElements.toolChromeDocking,
      getFloatingChromeViewports: () => this.detachedViewportWindow.getViewports(),
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      showStatusMessage: (message) => this.showStatusMessage(message),
      syncPrimitivesToViewports: () => this.syncPrimitivesToViewports(),
      refreshOutliner: () => this.refreshOutliner(),
      updateShadingMeshes: () => this.shadingModeCoordinator.updateShadingMeshes(),
      onToolStateChanged: () => this.onClipToolStateChanged(),
      onClipCancel: () => this.onClipCancel(),
      onTransformMode: (mode) => this.onTransformMode(mode),
      faceInspectorReveal: () => this.faceInspectorReveal(),
      editorOverlayPolicy: this.editorOverlayPolicy,
      modalToolSessionRegistry: this.modalToolSessionRegistry,
      isEditorToolBusy: () => this.toolEditorSystem?.isActiveEventReceiverBusy() === true,
      switchToClipTool: () => this.toolEditorSystem?.switchToClipTool() === true,
      switchToObjectSelect: () => {
        this.toolEditorSystem?.switchToObjectSelect();
      },
      switchToFaceSelect: () => {
        this.toolEditorSystem?.switchToFaceSelect();
      },
      switchToEditSelect: () => {
        this.toolEditorSystem?.switchToEditSelect();
      },
      switchToGridTool: () => {
        this.toolEditorSystem?.switchToGridTool();
      },
      onGridReset: () => {
        this.gridOrientationHandler?.resetOrientation();
      },
      onGridAlignToFace: () => {
        this.toolEditorSystem?.switchToGridTool();
        this.toolEditorSystem?.editorWindow.getServices()?.pinExclusiveViewport();
        this.gridOrientationHandler?.armAlignPick();
      },
      onGridAlignAxis: (axis) => {
        this.toolEditorSystem?.switchToGridTool();
        this.toolEditorSystem?.editorWindow.getServices()?.pinExclusiveViewport();
        this.gridOrientationHandler?.armEdgeAlignPick(axis);
      },
      onGridOriginVertex: () => {
        this.toolEditorSystem?.switchToGridTool();
        this.toolEditorSystem?.editorWindow.getServices()?.pinExclusiveViewport();
        this.gridOrientationHandler?.armOriginVertexPick();
      },
      onCameraReset: () => {
        this.gridOrientationHandler?.resetCameraOrientation();
      },
      onCameraAlignToFace: () => {
        this.toolEditorSystem?.switchToGridTool();
        this.toolEditorSystem?.editorWindow.getServices()?.pinExclusiveViewport();
        this.gridOrientationHandler?.armCameraAlignPick();
      },
      onPrimaryToolChanged: () => {
        this.updateGizmoVisibility();
        this.updateGizmoPivot();
      },
      registerClipTool: (placement, handler) => {
        this.toolEditorSystem?.registerClipTool(placement, handler);
      },
      onEnterEditMode: () => this.editModeCoordinator?.enterFromObjectSelection() === true,
      onExitEditMode: () => {
        this.editModeCoordinator?.exitToObjectMode();
      },
      onComponentMode: (mode: EditorComponentMode) => {
        this.editModeCoordinator?.setComponentMode(mode);
      },
      onEditModePresentationChanged: () => {
        if (this.isEditModeActive()) {
          this.applyEditModeDefaultNoTransformWidget();
          this.editModeCoordinator?.suppressObjectModeWireframes();
          this.transformInteractionBridge?.clearBoundsHover();
          this.transformHandler?.clearBoundsHover();
        }
        this.updateGizmoVisibility();
        this.updateTransformButtons();
        this.refreshCadRulersFromSelection();
        this.selectionVisualController?.setObjectSelectionChromeEnabled(!this.isEditModeActive());
      },
      onApplyObjectTransform: (kind) => this.applyObjectTransformsFromChrome(kind),
      onConvexHull: () => this.hullBrushesFromChrome(),
      onShapeSettingChanged: () => this.shapeDrawSetup.shapeSettingChanged(),
      onEditKnife: () => this.toolEditorSystem?.editorWindow.useSingleUseEditKnifeTool(),
      onEditLoopCut: () => this.toolEditorSystem?.editorWindow.useSingleUseEditLoopCutTool(),
      onEditMerge: (mode) => {
        this.editModeCoordinator?.mergeSelection(mode);
      },
      onEditDissolve: () => {
        this.editModeCoordinator?.dissolveSelection();
      },
      onEditDelete: () => {
        this.editModeCoordinator?.deleteSelection();
      },
    });
    this.clipPlaneHandler = result.clipPlaneHandler;
    this.toolsPaletteController = result.toolsPaletteController;
    this.keyboardShortcutHandler.setOnComponentMode(
      (mode) => {
        this.toolsPaletteController?.setComponentMode(mode);
      },
      () => this.isEditModeActive(),
    );
    this.keyboardShortcutHandler.setOnDeleteEditComponents(() => this.editModeCoordinator?.deleteSelection());
    this.renderLoop.setClipPlaneHandler(result.clipPlaneHandler);
    this.renderLoop.setEditorOrientationCoordinator(this.editorOrientationCoordinator);
    this.renderLoop.setGridOrientationHandler(this.gridOrientationHandler);
    this.editorOverlayPolicy.addChangeListener(() => {
      this.refreshCadRulersFromSelection();
      this.updateGizmoVisibility();
    });
    this.floatingToolChromeSync();
  }

  /**
   * Attaches floating tool chrome to the detached viewports and removes it from
   * closed ones.
   */
  protected floatingToolChromeSync(): void {
    refreshViewportToolChrome(this.toolsPaletteController, () => this.detachedViewportWindow.getViewports());
  }

  /** Keeps translation snap aligned with the visual grid orientation. */
  private bindGridSnapToGridOrientation(): void {
    const coordinator = this.editorOrientationCoordinator;
    if (!coordinator) {
      return;
    }
    const gridOrientation = coordinator.getGridOrientation();
    this.pushGridOrientationIntoSnap(gridOrientation);
    gridOrientation.subscribe(() => {
      this.pushGridOrientationIntoSnap(gridOrientation);
    });
  }

  /**
   * Copies the grid plane and rotation onto snap, then refreshes gizmo
   * orientation.
   *
   * @param gridOrientation Live grid orientation store.
   */
  private pushGridOrientationIntoSnap(gridOrientation: EditorOrientation): void {
    this.gridSnap.setPlaneFrame(gridOrientation.getPlaneFrame());
    this.gridSnap.setWorkspaceBasisQuaternion(gridOrientation.getQuaternion());
    this.syncProjectedGridToSnapAndOrientation();
    this.updateGizmoPivot();
  }

  /**
   * Pushes the active snap interval and grid orientation into the projected
   * surface grid material.
   */
  private syncProjectedGridToSnapAndOrientation(): void {
    ManagerProjectedGrid.setCellSize(this.gridSnap.getInterval());
    const orientation = this.editorOrientationCoordinator?.getGridOrientation();
    if (orientation) {
      ManagerProjectedGrid.setPlaneFrame(orientation.getPlaneFrame());
    }
  }

  /** Cancels the clip tool and returns to object select in tool chrome. */
  protected onClipCancel(): void {
    cancelClipToolSelection(this.clipPlaneHandler, this.toolsPaletteController);
  }

  /** Refreshes tool chrome and hides transform gizmos while clipping. */
  protected onClipToolStateChanged(): void {
    this.toolsPaletteController?.refreshPaletteContext();
    this.updateGizmoVisibility();
  }

  /**
   * Shows or hides transform/bounds gizmos based on opt-in policy and
   * selection.
   */
  protected override updateGizmoVisibility(): void {
    if (this.componentTransformHandler?.isDragging() || this.transformHandler.isSingleUseDrag()) {
      this.transformGizmo.setVisible(false);
      return;
    }
    if (!this.editorOverlayPolicy.isAllowed(EditorOverlayId.TRANSFORM_GIZMOS)) {
      this.transformGizmo.setVisible(false);
      return;
    }
    if (this.isEditModeActive()) {
      const componentCount = this.editModeCoordinator?.getComponentSelectionCount() ?? 0;
      const mode = this.transformGizmo.getMode();
      const widgetsEnabled =
        mode === TransformMode.TRANSLATE || mode === TransformMode.ROTATE || mode === TransformMode.SCALE;
      this.transformGizmo.setVisible(componentCount > 0 && widgetsEnabled);
      return;
    }
    const selected = this.selectionManager.getAllSelectedObjectsAsArray();
    const unlockedSelected = filterUnlockedObjects(selected);
    this.transformGizmo.setVisible(unlockedSelected.length > 0);
  }

  /**
   * Clears permanent transform widgets when entering Edit Mode (Bounds
   * sentinel, no T/R/S toolbar highlight). G/R/S single-use tools still work.
   */
  protected applyEditModeDefaultNoTransformWidget(): void {
    this.transformGizmo.setMode(TransformMode.BOUNDS);
    this.toolsPaletteController?.setActiveTransformMode(TransformMode.BOUNDS);
  }

  /**
   * Returns whether Edit Mode is active.
   *
   * @returns True while component editing is live.
   */
  protected isEditModeActive(): boolean {
    return this.editModeCoordinator?.isActive() === true;
  }

  /**
   * Runs Object → Apply from Edit Mode chrome and refreshes domain
   * presentation.
   *
   * @param kind Apply kind.
   */
  protected applyObjectTransformsFromChrome(kind: ObjectApplyTransformKind): void {
    const handler = new HandlerObjectApplyTransform({
      commandStack: this.commandStack,
      getSelectedObjects: () => this.selectionManager.getAllSelectedObjectsAsArray(),
      getEditDomainTargets: () =>
        this.editModeCoordinator?.isActive() ? this.editModeCoordinator.getSession().getDomain() : null,
      showStatusMessage: (message) => this.showStatusMessage(message),
      onAfterApply: (objects) => {
        this.selectionVisualController?.rebuildHighlightGeometries();
        this.selectionVisualController?.refreshFromSelection();
        this.refreshVisualsAfterTransformCommit(objects);
        this.editModeCoordinator?.refreshDomainGeometryPresentation();
        this.updateGizmoVisibility();
        this.updateGizmoPivot();
      },
    });
    handler.apply(kind);
  }

  /** Builds a convex brush around the selected brushes and selects it. */
  protected hullBrushesFromChrome(): void {
    const handler = new HandlerSolidBrushHull({
      commandStack: this.commandStack,
      getSelectedObjects: () => this.selectionManager.getAllSelectedObjectsAsArray(),
      showStatusMessage: (message) => this.showStatusMessage(message),
    });
    const created = handler.run();
    const mesh = created?.mesh;
    if (!mesh) return;
    hullBrushSelectionFinish(this.selectionManager, mesh, () => this.refreshAfterWorldMutation());
  }

  /**
   * Cancels single-use tools first (Shape Editor Escape), then clears selection
   * and returns to object select.
   */
  protected onEscapeCancel(): void {
    if (this.toolEditorSystem?.cancelActiveSingleUseTool()) {
      this.statusBar?.setLastAction('Tool cancelled');
      return;
    }
    this.clipPlaneHandler?.cancel();
    this.toolsPaletteController?.selectTool(EditorToolId.OBJECT);
    this.faceModeCoordinator?.getFaceExtrusionController().clearFaceSelection();
    this.selectionManager.clearSelection();
    this.statusBar?.setLastAction('Selection cleared');
  }

  /** Creates the solid model floating panel and controller. */
  protected setupSolidModelPanel(): void {
    const setup = setupSolidModelLayout({
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      selectionManager: this.selectionManager,
      propertiesPanel: this.propertiesPanel,
      toolbarContainer: this.toolbarContainer,
      solidPanelAnchor: this.viewports[3]!,
      viewport3D: this.viewport3D,
      gridSnap: this.gridSnap,
      textureLock: this.textureLock,
      refreshAfterWorldMutation: () => this.refreshAfterWorldMutation(),
      refreshOutliner: () => this.refreshOutliner(),
      revealOutlinerObject: (object) => this.outlinerPanel.revealObject(object),
      showStatusMessage: (message) => this.showStatusMessage(message),
    });
    this.solidModelPanel = setup.solidModelPanel;
    this.solidModelController = setup.solidModelController;
    this.solidModelController.setTransformModeProvider(() => this.transformHandler.getMode());
    this.solidModelController.setActiveCameraProvider(() => this.getActiveSpawnCamera());
    this.solidModelController.setGridSnapProvider(() => this.gridSnap);
    this.solidModelController.setGridOrientationProvider(
      () => this.editorOrientationCoordinator?.getGridOrientation() ?? null,
    );
    this.solidModelController.adoptFirstSolidModelInWorld();
  }

  /** Creates the self-contained play-mode player system. */
  protected setupPlayerSystem(): void {
    this.playerSystem = setupPlayerLayout({
      worldRoot: this.worldObject,
      inputManager: this.inputManager,
      getEditorWindow: () => this.toolEditorSystem?.editorWindow ?? null,
      getPerspectiveViewports: () => this.collectPerspectiveViewports(),
      getInteractiveViewports: () => this.getAllInteractiveViewports(),
      showStatusMessage: (message) => this.showStatusMessage(message),
    });
  }

  /**
   * Collects live perspective viewports including detached panes.
   *
   * @returns Perspective viewport list.
   */
  protected collectPerspectiveViewports(): Viewport3D[] {
    const result: Viewport3D[] = [];
    const viewports = this.getAllInteractiveViewports();
    for (let index = 0; index < viewports.length; index++) {
      const viewport = viewports[index];
      if (viewport instanceof Viewport3D) {
        result.push(viewport);
      }
    }
    return result;
  }

  /**
   * Binds the EditorApi for MCP tool calls and creates the AI Captures debug
   * panel.
   */
  protected setupAiBridge(): void {
    setupLayoutAi({
      worldObject: this.worldObject,
      commandStack: this.commandStack,
      selectionManager: this.selectionManager,
      solidModelController: this.solidModelController,
      gridSnap: this.gridSnap,
      snapManager: this.snapManager,
      getUserSnapEnabled: () => this.userSnapEnabled,
      refreshAfterWorldMutation: () => this.refreshAfterWorldMutation(),
      refreshOutliner: () => this.refreshOutliner(),
      showStatusMessage: (message) => this.showStatusMessage(message),
      getScene: () => this.sharedWorldScene.getScene(),
      getRenderer: () => this.sharedSurface.getRenderer(),
      previewLinkServiceEnsure: () => this.gamePreviewLayoutEnsure().serviceEnsure(),
      projectWorkbenchEnsure: () => this.gamePreviewLayoutEnsure().workbenchEnsure(),
      sceneDocumentLoad: (sceneJson) =>
        this.sceneIOHandler.loadSceneFromText(sceneJson, this.worldObject, () => this.onSceneLoaded(), this.statusBar),
      issuesValidateNow: () => this.shellPanels?.issuesValidateNow() ?? [],
      mainWindowControlRead: () => new ShellMainWindowControl(this.shellElements),
      viewportsInteractiveRead: () => this.getAllInteractiveViewports(),
      objectPropertiesDialogRead: () => this.objectPropertiesDialogEnsure(),
    });
    this.setupAiCaptureDebugPanel();
  }

  /** Creates the floating AI Captures debug panel (capture_view image history). */
  protected setupAiCaptureDebugPanel(): void {
    if (this.aiCaptureDebugPanel) {
      return;
    }
    this.aiCaptureDebugPanel = new PanelAiCaptureDebug(this.toolbarContainer, this.resolveAiCaptureDebugAnchor());
    this.aiCaptureDebugPanel.setDefaultAnchorResolver(() => this.resolveAiCaptureDebugAnchor());
  }

  /**
   * Chooses a viewport pane as the default open position for AI Captures.
   *
   * @returns Anchor element or null.
   */
  protected resolveAiCaptureDebugAnchor(): HTMLElement | null {
    const viewport = this.getPrimaryPerspectiveViewport() ?? this.getAllLiveViewports()[0];
    return viewport ? viewport.getContainer() : null;
  }

  /** Toggles the floating AI Captures debug panel. */
  protected onToggleAiCaptureDebugPanel(): void {
    if (!this.aiCaptureDebugPanel) {
      this.setupAiCaptureDebugPanel();
    }
    this.aiCaptureDebugPanel?.toggle();
    if (this.aiCaptureDebugPanel?.isOpen()) {
      this.aiCaptureDebugPanel.refresh();
      this.statusBar?.setLastAction('AI Captures panel opened');
    }
  }

  /**
   * Toggles the floating Game Preview panel, creating the preview link on first
   * use.
   */
  protected onToggleGamePreviewPanel(): void {
    this.gamePreviewLayoutEnsure().panelToggle();
  }

  /**
   * Returns the game preview layout, creating it on first use.
   *
   * @returns The game preview layout.
   */
  protected gamePreviewLayoutEnsure(): LayoutGamePreview {
    this.gamePreviewLayout ??= new LayoutGamePreview({
      worldGroup: this.worldObject,
      panelHost: this.toolbarContainer,
      textureBrowserControllerRead: () => this.textureBrowserController,
      sceneFileNameRead: () => this.sceneIOHandler.sceneDocumentFileNameRead(),
      statusMessageShow: (message) => this.showStatusMessage(message),
      gameProfileRead: () => this.settingsStore?.getActiveGameProfile() ?? null,
    });
    return this.gamePreviewLayout;
  }

  /** Opens the MCP connection dialog from the main toolbar. */
  protected onOpenMcpDialog(): void {
    openLayoutMcpDialog(this.container, this.toolbar, this.statusBar, (message) => this.showStatusMessage(message));
  }

  /** Toggles editor audio feedback and reports the new state. */
  protected onToggleAudio(): void {
    audioContextHost.unlock();
    const enabled = audioSettings.toggle();
    this.statusBar?.setLastAction(enabled ? 'Audio on' : 'Audio off');
  }


  /** Toggles the solid model floating panel. */
  protected onToggleSolidModelPanel(): void {
    toggleLayoutSolidModelPanel(this.solidModelController, this.solidModelPanel, this.statusBar);
  }

  /** Creates a solid model with a default box brush. */
  protected onAddSolidModel(): void {
    this.solidModelController?.createSolidModel();
  }

  /** Opens the About dialog, creating it on first use. */
  protected onOpenAboutDialog(): void {
    const wasMissing = this.aboutDialog === null;
    this.aboutDialog = openLayoutAboutDialog(this.container, this.aboutDialog, this.statusBar);
    if (wasMissing) {
      this.registerToolEditorGuiSurface(this.aboutDialog, 'about_dialog');
    }
  }

  /**
   * Opens another detached viewport window for multi-monitor use. Each open
   * allocates its own WebGL surface; closed popups release that budget.
   */
  protected onOpenDetachedViewport(): void {
    openLayoutDetachedViewport(
      () => this.bindDetachedViewportRenderSource(),
      this.detachedViewportWindow,
      (message) => this.showStatusMessage(message),
    );
  }

  /** Opens the hosted user documentation in a separate browser tab. */
  protected onOpenDocumentation(): void {
    openLayoutDocumentation(this.statusBar);
  }

  /** Toggles the Settings dialog, creating store and dialog on first use. */
  protected onToggleSettingsDialog(): void {
    this.ensureSettingsSystem();
    this.ensureSettingsDialog();
    this.settingsDialog?.toggle();
    if (this.settingsDialog?.isOpen()) {
      this.statusBar?.setLastAction('Settings opened');
      return;
    }
    this.statusBar?.setLastAction('Settings closed');
  }

  /**
   * Ensures the settings store and applicator exist so preferences apply even
   * when the settings dialog has never been opened.
   */
  protected ensureSettingsSystem(): void {
    if (this.settingsStore) {
      return;
    }
    const parts = createLayoutSettingsSystem({
      getPerspectiveViewport: () => this.getPrimaryPerspectiveViewport(),
      getRendererHost: () =>
        this.getPrimaryPerspectiveViewport() ??
        this.getAllLiveViewports()[0] ??
        this.getAllInteractiveViewports()[0] ??
        null,
      viewportPaneLayout: this.viewportPaneLayout,
      toolbar: this.toolbar,
      resizeAll: () => this.resizeAll(),
      onVisibleSlots: (slots) => this.syncActivePanesFromSlots(slots),
      onViewportPaneCount: (paneCount) => {
        this.workspaceController?.applyPaneCountMigration(paneCount);
        this.refreshWorkspaceSwitcher();
      },
    });
    this.settingsStore = parts.settingsStore;
    this.settingsApplicator = parts.settingsApplicator;
    this.settingsUnsubscribe = parts.settingsUnsubscribe;
  }

  /**
   * Creates the settings dialog on first open so no modal DOM exists at
   * startup.
   */
  protected ensureSettingsDialog(): void {
    if (this.settingsDialog) {
      return;
    }
    this.ensureSettingsSystem();
    const store = this.settingsStore;
    if (!store) {
      return;
    }
    this.settingsDialog = createLayoutSettingsDialog(this.container, store);
    this.registerToolEditorGuiSurface(this.settingsDialog, 'settings_dialog');
  }

  /** Creates and initializes the snap settings controller. */
  protected setupSnapSettingsController(): void {
    this.snapSettingsController = createLayoutSnapSettingsController({
      gridSnap: this.gridSnap,
      snapManager: this.snapManager,
      textureLock: this.textureLock,
      toolbar: this.toolbar,
      statusBar: this.statusBar,
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      worldObject: this.worldObject,
      getViewports: () => this.getAllLiveViewports(),
      getUserSnapEnabled: () => this.userSnapEnabled,
      setUserSnapEnabled: (enabled) => {
        this.userSnapEnabled = enabled;
      },
    });
  }

}
