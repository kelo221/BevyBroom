import * as THREE from 'three';
import { ManagerInput } from '@/input/manager_input.js';
import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { Viewport2D } from '@/viewports/core/viewport_2d.js';
import { getCadViewPlaneForKind, type ViewportEditor } from '@/viewports/core/viewport_editor.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerSelectionVisual } from '@/selection/object/controller_selection_visual.js';
import { HandlerHierarchyReparent } from '@/outliner/hierarchy/handler_hierarchy_reparent.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { PanelOutliner } from '@/outliner/ui/panel_outliner.js';
import { PanelProperties } from '@/ui/properties/panel_properties.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSnap } from '@/transform/snap/manager_snap.js';
import { CommandStack } from '@/commands/command_stack.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { ManagerViewportSync } from './manager_viewport_sync.js';
import { HandlerPrimitiveCreation } from '@/tools/creation/handler_primitive_creation.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';
import { HandlerAlignment } from '@/outliner/alignment/handler_alignment.js';
import { AlignmentAxis } from '@/types/alignment_axis.js';
import { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import { HandlerCsgAction } from '@/tools/csg/handler_csg_action.js';
import { TerrainGenerator } from '@/terrain/terrain_generator.js';
import { ControllerUvEditor } from '@/texture/controller/controller_uv_editor.js';
import { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { bindEditorAudioSpaceProbe } from '@/audio/space/audio_space_probe_bind.js';
import { BuilderEditorShell, type EditorShellElements } from '@/layout/shell/builder_editor_shell.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { LayoutShellPanels } from '@/layout/shell/mount/layout_shell_panels.js';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';
import { ViewportSceneBootstrap } from './viewport_scene_bootstrap.js';
import { BridgeTransformInteraction } from '@/tools/bridge/bridge_transform_interaction.js';
import type { LayoutToolEditorSystem } from '@/layout/setup/layout_tool_editor_setup.js';
import { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import { ControllerSnapSettings } from '@/tools/snap/controller_snap_settings.js';
import { CoordinatorCameraFit } from '@/navigation/camera/coordinator_camera_fit.js';
import { CoordinatorShadingMode } from '@/navigation/camera/coordinator_shading_mode.js';
import { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import { DialogAbout } from '@/ui/about/dialog_about.js';
import { DialogSettings } from '@/ui/settings/dialog_settings.js';
import { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import { SettingsApplicator } from '@/settings/store/settings_applicator.js';
import { createLayoutCoreSystems } from '@/layout/setup/layout_core_bootstrap.js';
import {
  setupViewportMaximizeControls as wireViewportMaximizeControls,
  setupViewportTypeMenus as wireViewportTypeMenus,
  syncActivePanesFromSlots as applyActivePanesFromSlots,
  wireClipCallbackOnViewport as bindClipCallbackOnViewport,
} from '@/layout/setup/layout_viewport_chrome.js';
import {
  bindDetachedViewportRenderSource as attachDetachedRenderSource,
  wireDetachedViewport as attachDetachedViewport,
  onDetachedViewportDisposed as handleDetachedViewportDisposed,
} from '@/layout/setup/viewport_layout_detached.js';
import { findPrimaryPerspectiveViewport, resolveNamedViewportFields } from '@/layout/setup/layout_named_viewports.js';
import { SolidModelPanel } from '@/solid/ui/panel/solid_model_panel.js';
import { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { PlayerSystem } from '@/player/player_system.js';
import { PanelAiCaptureDebug } from '@/ai/client/ui/panel_ai_capture_debug.js';
import { refreshLayoutMcpToolbarButton } from '@/layout/setup/layout_toolbar_actions.js';
import { LayoutRenderLoop } from '@/layout/setup/layout_render_loop.js';
import { TransformSpace } from '@/types/transform_space.js';
import { TransformMode } from '@/types/transform_mode.js';
import { LayoutShapeDrawSetup } from '@/tools/shape_draw/layout/layout_shape_draw_setup.js';
import { ViewportPaneLayout } from './viewport_pane_layout.js';
import { CadRulerSystem } from '@/rulers/system/cad_ruler_system.js';
import { BuilderOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import {
  reattachCadRulersToViewports,
  refreshCadRulersFromSelection as rebuildCadRulersFromSelection,
} from '@/layout/setup/bridge_layout_cad_ruler.js';
import { ViewportRegistry } from './viewport_registry.js';
import { SharedWebGLSurface } from '@/viewports/shared/shared_webgl_surface.js';
import { SharedWorldScene } from '@/viewports/shared/shared_world_scene.js';
import { MultiViewComposer } from '@/viewports/core/multi_view_composer.js';
import { DetachedViewportWindow } from '@/viewports/detached/detached_viewport_window.js';
import { AreaLayoutInteraction } from '@/layout/area/area_layout_interaction.js';
import { WorkspaceStore } from '@/layout/workspace/workspace_store.js';
import { ControllerWorkspace } from '@/layout/workspace/controller_workspace.js';
import { WorkspaceSwitcherBar } from '@/ui/workspace/workspace_switcher_bar.js';
import { LayoutGamePreview } from '@/preview/layout/layout_game_preview.js';
import {
  type WorkspaceAreaWiringHost,
  wireWorkspaceSystem,
  wireAreaLayoutInteraction,
  refreshWorkspaceSwitcherBar,
} from '@/layout/setup/layout_workspace_area_wiring.js';
import {
  buildCadRulerHost,
  buildDetachedViewportHost,
  buildViewportChromeHost,
  buildWorkspaceAreaWiringHost,
  type LayoutCoreHostSource,
} from '@/layout/setup/layout_core_host_builders.js';

/**
 * Bootstrap and wiring base for the viewport layout manager. Owns shared fields
 * and early construction. Action and floating-panel methods live on the
 * concrete {@link ViewportLayoutManager} subclass.
 */
export abstract class ViewportLayoutCore {
  protected container: HTMLElement;
  protected viewports!: HTMLElement[];
  protected viewportArea!: HTMLElement;
  protected viewportPaneGrid!: HTMLElement;
  protected viewportPaneLayout!: ViewportPaneLayout;
  protected areaLayoutInteraction!: AreaLayoutInteraction | null;
  protected workspaceStore!: WorkspaceStore;
  protected workspaceController!: ControllerWorkspace | null;
  protected workspaceSwitcherBar!: WorkspaceSwitcherBar | null;
  protected viewportRegistry!: ViewportRegistry;
  protected sharedSurface!: SharedWebGLSurface;
  protected sharedWorldScene!: SharedWorldScene;
  protected multiViewComposer!: MultiViewComposer;
  protected detachedViewportWindow: DetachedViewportWindow;
  protected sceneBootstrap!: ViewportSceneBootstrap;
  /** Perspective viewport when present; null for orthographic-only layouts. */
  protected viewport3D: Viewport3D | null = null;
  /** Named 2D roles when present; null if that kind is not in the layout. */
  protected viewport2DTop: Viewport2D | null = null;
  protected viewport2DFront: Viewport2D | null = null;
  protected viewport2DSide: Viewport2D | null = null;
  protected inputManager!: ManagerInput;
  protected worldObject!: THREE.Group;
  protected isDisposed: boolean;
  protected readonly renderLoop: LayoutRenderLoop;
  protected selectionManager!: ManagerSelection;
  protected readonly shapeDrawSetup = new LayoutShapeDrawSetup({
    commandStackRead: () => this.commandStack,
    selectedObjectsRead: () => this.selectionManager.getAllSelectedObjectsAsArray(),
    statusMessageShow: (message) => this.showStatusMessage(message),
    worldMutationRefresh: () => this.refreshAfterWorldMutation(),
  });
  protected selectionVisualController!: ControllerSelectionVisual;
  protected hierarchyReparentHandler!: HandlerHierarchyReparent;
  protected primitiveTool!: ToolPrimitiveCreation;
  protected toolbar!: Toolbar;
  protected outlinerPanel!: PanelOutliner;
  protected propertiesPanel!: PanelProperties;
  protected toolbarContainer!: HTMLElement;
  /** Main window shell: docks, bars and their commands. */
  protected shellElements!: EditorShellElements;
  /** Docked inspector and info panel contents. */
  protected shellPanels: LayoutShellPanels | null = null;
  protected clipboardSystem: import('@/layout/setup/layout_clipboard_setup.js').LayoutClipboardSystem | null = null;
  protected transformGizmo!: GizmoTransform;
  protected gizmoRaycaster!: GizmoRaycaster;
  protected transformExecutor!: TransformExecutor;
  protected transformHandler!: HandlerTransform;
  protected componentTransformHandler!: import('@/edit/transform/handler_component_transform.js').HandlerComponentTransform;
  protected entityHandles!: import('@/entity/handles/entity_handle_system.js').EntityHandleSystem;
  protected layerSystem!: import('@/layer/layer_system.js').LayerSystem;
  protected layerManager!: import('@/layer/model/layer_manager.js').LayerManager;
  /** Shape Editor-style single-active-tool manager (SwitchTool / UseTool). */
  protected toolEditorSystem: LayoutToolEditorSystem | null = null;
  protected gridSnap!: GridSnap;
  protected userSnapEnabled!: boolean;
  protected transformSpace!: TransformSpace;
  protected snapManager!: ManagerSnap;
  protected commandStack!: CommandStack;
  protected statusBar!: StatusBar | null;
  protected viewportSyncManager!: ManagerViewportSync;
  protected primitiveCreationHandler!: HandlerPrimitiveCreation;
  protected keyboardShortcutHandler!: HandlerKeyboardShortcut;
  protected objectActionHandler!: HandlerObjectAction;
  protected alignmentHandler!: HandlerAlignment;
  protected sceneIOHandler!: HandlerSceneIo;
  protected faceModeCoordinator!: CoordinatorFaceMode;
  /** Displacement grid wireframes, alpha tints and paint cursor. */
  protected displacementOverlaySystem:
    import('@/displacement/overlay/displacement_overlay_system.js').DisplacementOverlaySystem | null = null;
  /** Sprinkle tool: stroke painting, brush resizing and the radius cursor. */
  protected sprinkleToolSystem: import('@/tools/sprinkle/setup/sprinkle_tool_system.js').SprinkleToolSystem | null =
    null;
  protected snapSettingsController!: ControllerSnapSettings;
  protected cameraFitCoordinator!: CoordinatorCameraFit;
  protected shadingModeCoordinator!: CoordinatorShadingMode;
  protected transformInteractionBridge!: BridgeTransformInteraction;
  protected csgActionHandler!: HandlerCsgAction;
  protected terrainGenerator!: TerrainGenerator;
  protected uvEditorController!: ControllerUvEditor | null;
  protected textureBrowserController!: ControllerTextureBrowser | null;
  protected textureAssignmentController!: ControllerTextureAssignment | null;
  protected textureLock!: TextureLockSettings;
  protected toolsPaletteController!: ControllerViewportToolChrome | null;
  protected editModeCoordinator!: CoordinatorEditMode | null;
  protected aboutDialog!: DialogAbout | null;
  protected settingsDialog!: DialogSettings | null;
  protected settingsStore!: EditorSettingsStore | null;
  protected settingsApplicator!: SettingsApplicator | null;
  protected settingsUnsubscribe!: (() => void) | null;
  protected clipPlaneTool!: ToolClipPlane;
  protected clipPlaneHandler!: HandlerClipPlane | null;
  protected editorOrientationCoordinator!:
    import('@/navigation/orientation/coordinator_editor_orientation.js').CoordinatorEditorOrientation | null;
  protected gridOrientationHandler!: import('@/tools/grid/handler_grid_orientation.js').HandlerGridOrientation | null;
  protected solidModelPanel!: SolidModelPanel | null;
  protected solidModelController!: SolidModelController | null;
  protected playerSystem: PlayerSystem | null = null;
  protected aiCaptureDebugPanel!: PanelAiCaptureDebug | null;
  protected gamePreviewLayout: LayoutGamePreview | null = null;
  protected cadRulerSystem!: CadRulerSystem;
  protected rulerBoundsBuilder!: BuilderOrientedBounds;
  protected editorOverlayPolicy!: PolicyEditorOverlay;
  protected modalToolSessionRegistry!: RegistryModalToolSession;

  /**
   * Constructs the layout core: core systems, shell and viewports, handlers,
   * render loop, and resize watching.
   *
   * @param editorContainer Root DOM element that hosts the layout.
   */
  constructor(editorContainer: HTMLElement) {
    this.container = editorContainer;
    this.isDisposed = false;
    this.renderLoop = new LayoutRenderLoop();
    this.detachedViewportWindow = new DetachedViewportWindow({
      hooks: {
        onViewportReady: (viewport) => this.wireDetachedViewport(viewport),
        onViewportDisposed: (viewport) => this.onDetachedViewportDisposed(viewport),
        onPopupWindowReady: (popup) => this.keyboardShortcutHandler?.registerOnWindow(popup),
        onPopupWindowClosed: (popup) => this.keyboardShortcutHandler?.unregisterFromWindow(popup),
        prepareViewportPass: (viewport) => {
          this.cadRulerSystem.prepareForCamera(viewport.getCamera());
          this.prepareDetachedGizmoBoundsScreenSpace(viewport);
        },
        finalizeViewportPass: () => this.cadRulerSystem.endCameraPass(),
      },
    });
    this.initializeCoreSystems();
    this.buildShellAndViewports();
    this.wireHandlersAndCoordinators();
    this.bindRenderLoop();
    this.watchResize();
  }

  /** Assigns core managers that do not depend on DOM layout. */
  protected initializeCoreSystems(): void {
    Object.assign(this, createLayoutCoreSystems());
    this.uvEditorController = null;
    this.textureBrowserController = null;
    this.textureAssignmentController = null;
    this.toolsPaletteController = null;
    this.editModeCoordinator = null;
    this.aboutDialog = null;
    this.settingsDialog = null;
    this.settingsStore = null;
    this.settingsApplicator = null;
    this.settingsUnsubscribe = null;
    this.clipPlaneHandler = null;
    this.editorOrientationCoordinator = null;
    this.gridOrientationHandler = null;
    this.solidModelPanel = null;
    this.solidModelController = null;
    this.aiCaptureDebugPanel = null;
    this.transformSpace = TransformSpace.Global;
    this.cadRulerSystem = new CadRulerSystem();
    this.rulerBoundsBuilder = new BuilderOrientedBounds();
  }

  /** Builds the DOM shell and instantiates the four viewports. */
  protected buildShellAndViewports(): void {
    const shell = new BuilderEditorShell().build(
      this.container,
      {
        selectionManager: this.selectionManager,
        worldObject: this.worldObject,
        commandStack: this.commandStack,
        gridSnap: this.gridSnap,
        textureLock: this.textureLock,
        hierarchyReparentHandler: this.hierarchyReparentHandler,
      },
      {
        outlinerActions: this.createOutlinerActions(),
        toolbarActions: this.createToolbarShellActionsBundle(),
        windowActions: this.createShellWindowActions(),
      },
    );
    this.shellElements = shell;
    this.toolbarContainer = shell.toolbarContainer;
    this.viewportArea = shell.viewportArea;
    this.viewportPaneGrid = shell.viewportPaneGrid;
    this.viewports = shell.viewports;
    this.viewportPaneLayout = new ViewportPaneLayout(shell.viewportPaneGrid, this.viewports);
    this.areaLayoutInteraction = null;
    this.workspaceStore = new WorkspaceStore();
    this.workspaceController = null;
    this.workspaceSwitcherBar = null;
    this.toolbar = shell.toolbar;
    this.outlinerPanel = shell.outlinerPanel;
    this.propertiesPanel = shell.propertiesPanel;
    this.statusBar = shell.statusBar;
    this.assignViewportsFromBootstrap();
    this.bindAreaLayoutInteraction();
    this.bindWorkspaceSystem();
    this.syncPrimitivesToViewports();
    this.updateTransformButtons();
    bindEditorAudioSpaceProbe(this.worldObject, this.selectionManager);
    void this.refreshMcpToolbarButton();
  }

  /**
   * Creates the workspace controller and switcher bar after the registry
   * exists.
   */
  protected bindWorkspaceSystem(): void {
    wireWorkspaceSystem(this.getWorkspaceAreaWiringHost());
  }

  /** Rebuilds workspace switcher tabs from the store. */
  protected refreshWorkspaceSwitcher(): void {
    refreshWorkspaceSwitcherBar(this.getWorkspaceAreaWiringHost());
  }

  /**
   * Wires splitters and corner gestures after the registry exists so structural
   * mutations can create and dispose panes safely.
   */
  protected bindAreaLayoutInteraction(): void {
    wireAreaLayoutInteraction(this.getWorkspaceAreaWiringHost());
  }

  /**
   * Builds the host bag for workspace and area tiling wiring helpers.
   *
   * @returns Workspace/area wiring host.
   */
  protected getWorkspaceAreaWiringHost(): WorkspaceAreaWiringHost {
    return buildWorkspaceAreaWiringHost(this.toLayoutCoreHostSource());
  }

  /**
   * Rebinds shared scene objects, tools, and chrome after area structure
   * changes (split, join, workspace switch).
   */
  protected rewireAfterAreaStructureChange(): void {
    this.sceneBootstrap.rewireAfterViewportMutation(
      this.worldObject,
      this.viewportRegistry,
      this.sharedWorldScene,
      this.viewportSyncManager,
      this.transformGizmo,
    );
    this.selectionVisualController?.wireViewports(this.getAllLiveViewports());
    this.transformInteractionBridge?.setViewportProbe((clientX, clientY) =>
      this.findInteractiveViewportAtClientPointForTools(
        clientX,
        clientY,
        this.toolEditorSystem?.editorWindow.lastPointerOwnerDocument ?? null,
      ),
    );
    this.editorOrientationCoordinator?.bindViewports();
    this.toolEditorSystem?.refreshInteractiveViewportDomain();
    this.shadingModeCoordinator?.rebindViewportUi();
    this.attachCadRulers();
    this.watchResize();
    this.resizeAll();
  }

  /**
   * Finds an interactive viewport under a client point for tool/gizmo probes.
   * Client coordinates are window-local; when ownerDocument is set only panes
   * in that document are considered.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param ownerDocument Optional document that owns the client coordinates.
   * @returns Viewport, or null.
   */
  private findInteractiveViewportAtClientPointForTools(
    clientX: number,
    clientY: number,
    ownerDocument: Document | null = null,
  ):
    import('@/viewports/core/viewport_3d.js').Viewport3D | import('@/viewports/core/viewport_2d.js').Viewport2D | null {
    const hit = findPickSurfaceAtClientPoint(
      this.getAllInteractiveViewports(),
      (viewport) => viewport.getContentElement(),
      clientX,
      clientY,
      ownerDocument,
    );
    if (!hit) {
      return null;
    }
    return hit as
      import('@/viewports/core/viewport_3d.js').Viewport3D | import('@/viewports/core/viewport_2d.js').Viewport2D;
  }

  /** Creates viewports, sync manager, and shared scene objects. */
  protected assignViewportsFromBootstrap(): void {
    this.sharedWorldScene = new SharedWorldScene();
    this.sharedSurface = new SharedWebGLSurface(this.viewportArea);
    this.multiViewComposer = new MultiViewComposer(this.sharedSurface);
    this.sceneBootstrap = new ViewportSceneBootstrap();
    const bootstrapped = this.sceneBootstrap.createViewports(
      this.viewports,
      this.inputManager,
      this.sharedWorldScene,
      this.sharedSurface,
    );
    this.viewportRegistry = bootstrapped.registry;
    this.refreshNamedViewportFields();
    this.viewportSyncManager = new ManagerViewportSync(
      this.viewport2DTop,
      this.viewport2DFront,
      this.viewport2DSide,
      this.viewport3D,
    );
    this.sceneBootstrap.addSharedObjects(
      this.worldObject,
      bootstrapped,
      this.sharedWorldScene,
      this.viewportSyncManager,
      this.transformGizmo,
    );
    this.attachCadRulers();
    this.bindDetachedViewportRenderSource();
  }

  /**
   * Points detached multi-monitor windows at the shared scene, world root, and
   * optional seed camera so each popup can allocate its own interactive
   * renderer.
   */
  protected bindDetachedViewportRenderSource(): void {
    attachDetachedRenderSource(this.getDetachedViewportHost());
  }

  /**
   * Wires selection, gizmo, transform, clip, face, and fit hooks on a detached
   * pane so it behaves like an in-window viewport.
   *
   * @param viewport Newly created or kind-switched detached viewport.
   */
  protected wireDetachedViewport(viewport: ViewportEditor): void {
    attachDetachedViewport(this.getDetachedViewportHost(), viewport);
    this.toolEditorSystem?.refreshInteractiveViewportDomain();
    this.toolsPaletteController?.attachPane(viewport.getContainer());
  }

  /**
   * Handles teardown notification for a disposed detached viewport instance.
   *
   * @param _viewport Viewport that is no longer live.
   */
  protected onDetachedViewportDisposed(_viewport: ViewportEditor): void {
    handleDetachedViewportDisposed(this.getDetachedViewportHost());
    this.toolEditorSystem?.refreshInteractiveViewportDomain();
  }

  /**
   * Applies screen-space bounds grip sizing for a detached pane pass.
   *
   * @param viewport Detached viewport being prepared.
   */
  protected prepareDetachedGizmoBoundsScreenSpace(viewport: ViewportEditor): void {
    const group = viewport.getGizmoGroup();
    if (!group) return;
    const camera = viewport.getCamera();
    const content = viewport.getContentElement();
    const height = Math.max(1, content.clientHeight || content.offsetHeight || 512);
    const viewPlane = getCadViewPlaneForKind(viewport.getViewportKind());
    this.transformGizmo.prepareTransformCloneForCamera(group, camera);
    this.transformGizmo.prepareBoundsCloneForCamera(group, camera, viewPlane, height);
  }

  /**
   * Builds the detached-viewport host bag for multi-monitor wiring.
   *
   * @returns Detached viewport host.
   */
  protected getDetachedViewportHost() {
    return buildDetachedViewportHost(this.toLayoutCoreHostSource());
  }

  /**
   * Returns main-window viewports plus any open detached panes.
   *
   * @returns Combined live viewport list.
   */
  protected getAllInteractiveViewports(): ViewportEditor[] {
    return [...this.getAllLiveViewports(), ...this.detachedViewportWindow.getViewports()];
  }

  /**
   * Assigns named viewport fields (top, front, side, perspective) from the
   * registry when those kinds are present.
   */
  protected refreshNamedViewportFields(): void {
    const named = resolveNamedViewportFields(this.viewportRegistry.getAllViewports());
    this.viewport2DTop = named.viewport2DTop;
    this.viewport2DFront = named.viewport2DFront;
    this.viewport2DSide = named.viewport2DSide;
    this.viewport3D = named.viewport3D;
    this.playerSystem?.refreshViewportChrome();
  }

  /**
   * Returns a preferred perspective viewport, or any live viewport camera host.
   *
   * @returns Primary Viewport3D when available.
   */
  protected getPrimaryPerspectiveViewport(): Viewport3D | null {
    return findPrimaryPerspectiveViewport(this.getAllLiveViewports());
  }

  /**
   * Returns live viewports currently considered active for render and input, in
   * multi-view draw order (orthographic first, then perspective).
   *
   * @returns Active editor viewports.
   */
  protected getActiveViewports(): readonly ViewportEditor[] {
    return this.viewportRegistry.getActiveViewports();
  }

  /**
   * Returns every live viewport instance regardless of active flag.
   *
   * @returns All viewport instances.
   */
  protected getAllLiveViewports(): ViewportEditor[] {
    return this.viewportRegistry.getAllViewports();
  }

  /**
   * Returns a primary scene for tools that need a single scene root.
   *
   * @returns Host scene when available, otherwise the first live scene.
   */
  protected getPrimaryScene(): THREE.Scene {
    return this.sharedWorldScene.getScene();
  }

  /** Rebuilds CAD size dimensions for the current selection (or clears them). */
  protected refreshCadRulersFromSelection(): void {
    rebuildCadRulersFromSelection(this.getCadRulerHost());
  }

  /** Attaches CAD ruler overlays to every interactive viewport. */
  protected attachCadRulers(): void {
    reattachCadRulersToViewports(
      this.getCadRulerHost(),
      this.sharedWorldScene.getScene(),
      this.getAllInteractiveViewports(),
    );
  }

  /** Wires specialized handlers after viewports and shell exist. */
  protected abstract wireHandlersAndCoordinators(): void;

  /** Shows or hides transform gizmos from overlay policy and selection. */
  protected abstract updateGizmoVisibility(): void;

  /** Wires maximize/restore actions on all viewport overlay toolbars. */
  protected setupViewportMaximizeControls(): void {
    wireViewportMaximizeControls(this.getViewportChromeHost());
  }

  /**
   * Syncs registry active flags from classic grid slot names (top/front/side/
   * perspective).
   *
   * @param slots Visible slot names from the pane layout.
   */
  protected syncActivePanesFromSlots(slots: readonly string[]): void {
    applyActivePanesFromSlots(this.getViewportChromeHost(), slots);
  }

  /** Wires the viewport kind dropdown on every live toolbar. */
  protected setupViewportTypeMenus(): void {
    wireViewportTypeMenus(this.getViewportChromeHost());
  }

  /**
   * Binds the clip-plane pointer callback on one viewport when the tool exists.
   *
   * @param viewport Viewport to wire.
   */
  protected wireClipCallbackOnViewport(viewport: ViewportEditor): void {
    bindClipCallbackOnViewport(this.getViewportChromeHost(), viewport);
  }

  /**
   * Builds the chrome host bag for maximize, type menu, and clip wiring.
   *
   * @returns Viewport chrome host.
   */
  protected getViewportChromeHost() {
    return buildViewportChromeHost(this.toLayoutCoreHostSource());
  }

  /**
   * Builds the CAD ruler host bag for selection and transform feedback.
   *
   * @returns CAD ruler host.
   */
  protected getCadRulerHost() {
    return buildCadRulerHost(this.toLayoutCoreHostSource());
  }

  /**
   * Adapts this layout core instance into the host-builder field source.
   *
   * @returns Layout core host source.
   */
  private toLayoutCoreHostSource(): LayoutCoreHostSource {
    return {
      workspaceSwitcherSlot: this.shellElements.layoutChooserSlot,
      viewportArea: this.viewportArea,
      viewportPaneGrid: this.viewportPaneGrid,
      workspaceStore: this.workspaceStore,
      workspaceController: this.workspaceController,
      workspaceSwitcherBar: this.workspaceSwitcherBar,
      areaLayoutInteraction: this.areaLayoutInteraction,
      viewportRegistry: this.viewportRegistry,
      viewportPaneLayout: this.viewportPaneLayout,
      detachedViewportWindow: this.detachedViewportWindow,
      sharedWorldScene: this.sharedWorldScene,
      worldObject: this.worldObject,
      transformGizmo: this.transformGizmo,
      viewportSyncManager: this.viewportSyncManager,
      selectionVisualController: this.selectionVisualController,
      transformInteractionBridge: this.transformInteractionBridge,
      faceModeCoordinator: this.faceModeCoordinator,
      cameraFitCoordinator: this.cameraFitCoordinator,
      shadingModeCoordinator: this.shadingModeCoordinator,
      clipPlaneHandler: this.clipPlaneHandler,
      cadRulerSystem: this.cadRulerSystem,
      rulerBoundsBuilder: this.rulerBoundsBuilder,
      transformHandler: this.transformHandler,
      selectionManager: this.selectionManager,
      statusBar: this.statusBar,
      editorOverlayPolicy: this.editorOverlayPolicy,
      setWorkspaceController: (controller) => {
        this.workspaceController = controller;
      },
      setWorkspaceSwitcherBar: (bar) => {
        this.workspaceSwitcherBar = bar;
      },
      setAreaLayoutInteraction: (interaction) => {
        this.areaLayoutInteraction = interaction;
      },
      getViewportChromeHost: () => this.getViewportChromeHost(),
      resizeAll: () => this.resizeAll(),
      refreshNamedViewportFields: () => this.refreshNamedViewportFields(),
      rewireAfterAreaStructureChange: () => this.rewireAfterAreaStructureChange(),
      getPrimaryPerspectiveViewport: () => this.getPrimaryPerspectiveViewport(),
      wireClipCallbackOnViewport: (viewport) => this.wireClipCallbackOnViewport(viewport),
      updateGizmoVisibility: () => this.updateGizmoVisibility(),
      attachCadRulers: () => this.attachCadRulers(),
      showStatusMessage: (message) => this.showStatusMessage(message),
    };
  }

  /**
   * Queries desktop MCP host status and glows the toolbar MCP button when the
   * server is running.
   */
  protected async refreshMcpToolbarButton(): Promise<void> {
    await refreshLayoutMcpToolbarButton(this.toolbar);
  }

  /** @returns Outliner action callback bundle for the shell builder. */
  protected abstract createOutlinerActions(): import('@/layout/shell/builder_editor_shell.js').EditorShellOutlinerActions;

  /** @returns Toolbar action callback bundle for the shell builder. */
  protected abstract createToolbarShellActionsBundle(): import('@/layout/shell/builder_editor_shell.js').EditorToolbarActions;

  /** Binds the shared render loop to live viewports and coordinators. */
  protected abstract bindRenderLoop(): void;

  /** Creates ResizeObserver-based resize handling for workspace and panes. */
  protected abstract watchResize(): void;

  /** Syncs world selectables to viewports and refreshes selection visuals. */
  protected abstract syncPrimitivesToViewports(): void;

  /** Updates tool chrome transform highlights and status bar mode text. */
  protected abstract updateTransformButtons(): void;

  /** Refreshes the outliner panel from the live world hierarchy. */
  protected abstract refreshOutliner(): void;

  /** Wires selection state, outlines, and gizmo visibility across viewports. */
  protected abstract wireSelectionSystem(): void;

  /** Sets up the transform gizmo system and event wiring. */
  protected abstract setupTransformSystem(): void;

  /** Sets up keyboard shortcuts using the dedicated shortcut handler. */
  protected abstract setupKeyboardShortcuts(): void;

  /** Builds and mounts the docked inspector and info panel contents. */
  protected abstract setupShellPanels(): void;

  /** @returns The Object Properties dialog, created on first use. */
  protected abstract objectPropertiesDialogEnsure(): import('@/ui/object_properties/dialog_object_properties.js').DialogObjectProperties;

  /**
   * Starts protecting unsaved work and offers work kept from an earlier
   * session.
   */
  protected abstract setupSceneRecovery(): void;

  /**
   * Builds the main window selection, view, play, tool and grid commands.
   *
   * @returns Window actions.
   */
  protected abstract createShellWindowActions(): ShellWindowActions;

  /** Handles post-primitive-creation synchronization and UI refresh. */
  protected abstract onPrimitiveCreated(): void;

  /** Full visual refresh after hierarchy/world mutations. */
  protected abstract refreshAfterWorldMutation(): void;

  /** Refreshes selection, history, panels and visuals after a scene was loaded. */
  protected abstract onSceneLoaded(): void;

  /**
   * Pose-commit refresh (solid finalize once + overlays) after transform
   * writes.
   */
  protected abstract refreshVisualsAfterTransformCommit(transformedObjects: readonly THREE.Object3D[]): void;

  /** @param message Status bar message text. */
  protected abstract showStatusMessage(message: string): void;

  /** @param axis Active alignment axis restriction. */
  protected abstract onAxisRestrictionChanged(axis: AlignmentAxis): void;

  /** Resizes the shared surface and every active pane camera. */
  protected abstract resizeAll(): void;

  /** Updates the gizmo pivot to the selection center. */
  protected abstract updateGizmoPivot(): void;

  /** @param mode Transform mode to activate. */
  protected abstract onTransformMode(mode: TransformMode): void;

  /** Opens the floating texture browser holding the face inspector. */
  protected abstract faceInspectorReveal(): void;

  /** Opens the Face Edit Sheet. */
  protected abstract faceEditSheetReveal(): void;

  /** @returns True when face selection mode is active. */
  protected abstract isFaceSelectionModeActive(): boolean;

  /** @returns True when the clip plane tool is active. */
  protected abstract isClipPlaneToolActive(): boolean;
}
