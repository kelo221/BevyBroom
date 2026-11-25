import type * as THREE from 'three';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';
import { getCadViewPlaneForKind, isPerspectiveViewport } from '@/viewports/core/viewport_editor.js';
import { CoordinatorCameraFit } from '@/navigation/camera/coordinator_camera_fit.js';
import type { CoordinatorEditorOrientation } from '@/navigation/orientation/coordinator_editor_orientation.js';
import type { HandlerGridOrientation } from '@/tools/grid/handler_grid_orientation.js';
import { MultiViewComposer, type MultiViewPanePass } from '@/viewports/core/multi_view_composer.js';
import type { SharedWorldScene } from '@/viewports/shared/shared_world_scene.js';
import type { CadRulerSystem } from '@/rulers/system/cad_ruler_system.js';
import type { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import type { HandlerTransform } from '@/transform/core/handler_transform.js';
import { managerMouseCursor } from '@/input/manager_mouse_cursor.js';
import { notificationFrameEvents } from '@/audio/notification/notification_frame_events.js';
import { controllerAudioPlayback } from '@/audio/playback/controller_audio_playback.js';
import { Theme } from '@/theme.js';
import {
  RENDER_DEMAND_SCHEDULER_TIMING_DEFAULT,
  RenderDemandScheduler,
} from '@/layout/render_demand/render_demand_scheduler.js';

/**
 * Mutable multi-view pass with a stable viewport reference so per-frame
 * closures can be created once and reused.
 */
interface ReusableMultiViewPass extends MultiViewPanePass {
  viewport: ViewportEditor;
}

/** Owns the editor animation frame loop and resize disconnect helpers. */
export class LayoutRenderLoop {
  private isRunning: boolean;
  private isDisposed: boolean;
  private animationFrameId: number | null;
  private lastTime: number;
  private resizeObserver: ResizeObserver | null;
  private getActiveViewports: (() => readonly ViewportEditor[]) | null;
  private cameraFitCoordinator: CoordinatorCameraFit | null;
  private editorOrientationCoordinator: CoordinatorEditorOrientation | null;
  private gridOrientationHandler: HandlerGridOrientation | null;
  private cadRulerSystem: CadRulerSystem | null;
  private transformGizmo: GizmoTransform | null;
  private transformHandler: HandlerTransform | null;
  private onBeforeRender: (() => void) | null;
  private multiViewComposer: MultiViewComposer | null;
  private sharedScene: SharedWorldScene | null;
  private boundOnAnimationFrame: () => void;
  private multiViewPassPool: ReusableMultiViewPass[];
  private multiViewPasses: ReusableMultiViewPass[];
  private readonly renderDemandScheduler: RenderDemandScheduler | null;
  private readonly frameCameras: THREE.Camera[];

  /**
   * Creates an idle render loop.
   *
   * @param renderDemandScheduler Scheduler that decides which frames draw; null
   *   draws every frame. Defaults to one watching the page window.
   */
  constructor(
    renderDemandScheduler: RenderDemandScheduler | null = LayoutRenderLoop.renderDemandSchedulerCreateDefault(),
  ) {
    this.isRunning = false;
    this.isDisposed = false;
    this.animationFrameId = null;
    this.lastTime = 0;
    this.resizeObserver = null;
    this.getActiveViewports = null;
    this.cameraFitCoordinator = null;
    this.editorOrientationCoordinator = null;
    this.gridOrientationHandler = null;
    this.cadRulerSystem = null;
    this.transformGizmo = null;
    this.transformHandler = null;
    this.onBeforeRender = null;
    this.multiViewComposer = null;
    this.sharedScene = null;
    this.boundOnAnimationFrame = () => this.onAnimationFrame();
    this.multiViewPassPool = [];
    this.multiViewPasses = [];
    this.renderDemandScheduler = renderDemandScheduler;
    this.frameCameras = [];
  }

  /**
   * Creates the scheduler watching the page window, or none outside a browser.
   *
   * @returns Default scheduler or null.
   */
  private static renderDemandSchedulerCreateDefault(): RenderDemandScheduler | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return new RenderDemandScheduler(window, () => performance.now(), RENDER_DEMAND_SCHEDULER_TIMING_DEFAULT);
  }

  /** Asks for the views to be drawn on the next frames even without user input. */
  renderRequest(): void {
    this.renderDemandScheduler?.request();
  }

  /**
   * Treats input on another window, such as a popup viewport, like input on the
   * editor window.
   *
   * @param watchedWindow Window to watch.
   */
  renderDemandWindowWatchAdd(watchedWindow: Window): void {
    this.renderDemandScheduler?.windowWatchAdd(watchedWindow);
  }

  /**
   * Stops treating input on a window added with
   * {@link renderDemandWindowWatchAdd}.
   *
   * @param watchedWindow Window to stop watching.
   */
  renderDemandWindowWatchRemove(watchedWindow: Window): void {
    this.renderDemandScheduler?.windowWatchRemove(watchedWindow);
  }

  /**
   * Binds viewports and shared multi-view resources used each frame. Surface
   * and workspace sizing stay on MultiViewComposer / watchResize.
   *
   * @param parts Live layout subsystems for the render path.
   */
  bind(parts: {
    getActiveViewports: () => readonly ViewportEditor[];
    cameraFitCoordinator: CoordinatorCameraFit;
    editorOrientationCoordinator?: CoordinatorEditorOrientation | null;
    gridOrientationHandler?: HandlerGridOrientation | null;
    cadRulerSystem?: CadRulerSystem | null;
    transformGizmo?: GizmoTransform | null;
    transformHandler?: HandlerTransform | null;
    onBeforeRender: () => void;
    multiViewComposer: MultiViewComposer;
    sharedScene: SharedWorldScene;
  }): void {
    this.getActiveViewports = parts.getActiveViewports;
    this.cameraFitCoordinator = parts.cameraFitCoordinator;
    this.editorOrientationCoordinator = parts.editorOrientationCoordinator ?? null;
    this.gridOrientationHandler = parts.gridOrientationHandler ?? null;
    this.cadRulerSystem = parts.cadRulerSystem ?? null;
    this.transformGizmo = parts.transformGizmo ?? null;
    this.transformHandler = parts.transformHandler ?? null;
    this.onBeforeRender = parts.onBeforeRender;
    this.multiViewComposer = parts.multiViewComposer;
    this.sharedScene = parts.sharedScene;
  }

  /**
   * Updates the grid orientation handler used for align-preview scale.
   *
   * @param handler Grid orientation handler or null.
   */
  setGridOrientationHandler(handler: HandlerGridOrientation | null): void {
    this.gridOrientationHandler = handler;
  }

  /**
   * Updates the orientation coordinator used for reorientation animation.
   *
   * @param coordinator Orientation coordinator or null.
   */
  setEditorOrientationCoordinator(coordinator: CoordinatorEditorOrientation | null): void {
    this.editorOrientationCoordinator = coordinator;
  }

  /**
   * Watches workspace and viewport elements and invokes a resize callback.
   *
   * @param elements Elements that affect pane layout size.
   * @param onResize Resize handler.
   */
  watchResize(elements: HTMLElement[], onResize: () => void): void {
    this.disconnectResizeObserver();
    this.resizeObserver = new ResizeObserver(() => {
      this.renderRequest();
      requestAnimationFrame(() => onResize());
    });
    elements.forEach((element) => this.resizeObserver?.observe(element));
  }

  /** Starts the render loop. */
  start(): void {
    if (this.isRunning || this.isDisposed) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  /** Stops the render loop without disposing resources. */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Stops the loop and disconnects resize observation. */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.stop();
    this.disconnectResizeObserver();
    this.renderDemandScheduler?.dispose();
    managerMouseCursor.reset();
  }

  /**
   * Returns whether the loop has been disposed.
   *
   * @returns True when disposed.
   */
  getIsDisposed(): boolean {
    return this.isDisposed;
  }

  /** Schedules the next animation frame while running. */
  private scheduleNextFrame(): void {
    this.animationFrameId = requestAnimationFrame(this.boundOnAnimationFrame);
  }

  /** Advances one frame of viewport updates and multi-view rendering. */
  private onAnimationFrame(): void {
    if (!this.isFrameRunnable() || !this.getActiveViewports) {
      this.animationFrameId = null;
      return;
    }
    notificationFrameEvents.beginFrame();
    const activeViewports = this.getActiveViewports();
    this.frameAnimationsAdvance(activeViewports);
    this.frameCamerasCollect(activeViewports);
    if (this.isFrameDrawNeeded()) {
      this.frameDraw(activeViewports);
    }
    controllerAudioPlayback.endFrame();
    this.scheduleNextFrame();
  }

  /**
   * Returns whether the loop is running, not disposed and bound to a composer
   * and a scene.
   *
   * @returns True when a frame can run.
   */
  private isFrameRunnable(): boolean {
    return this.isRunning && !this.isDisposed && this.multiViewComposer !== null && this.sharedScene !== null;
  }

  /**
   * Advances flying cameras, camera fits and orientation animations by the time
   * since the previous frame.
   *
   * @param activeViewports Active panes this frame.
   */
  private frameAnimationsAdvance(activeViewports: readonly ViewportEditor[]): void {
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.updatePerspectiveViewports(activeViewports, delta);
    this.cameraFitCoordinator?.updateAnimations();
    this.editorOrientationCoordinator?.updateAnimations();
  }

  /**
   * Fills the reusable camera list with the camera of every active pane.
   *
   * @param activeViewports Active panes this frame.
   */
  private frameCamerasCollect(activeViewports: readonly ViewportEditor[]): void {
    this.frameCameras.length = 0;
    activeViewports.forEach((viewport) => this.frameCameras.push(viewport.getCamera()));
  }

  /**
   * Returns whether this frame draws, asking the scheduler when there is one.
   *
   * @returns True when the views must be drawn.
   */
  private isFrameDrawNeeded(): boolean {
    return this.renderDemandScheduler?.isDrawNeeded(this.frameCameras) ?? true;
  }

  /**
   * Runs the per-drawing hooks, draws every active pane, refreshes the cursor
   * and records the drawing with the scheduler.
   *
   * @param activeViewports Active panes this frame.
   */
  private frameDraw(activeViewports: readonly ViewportEditor[]): void {
    this.onBeforeRender?.();
    this.gridOrientationHandler?.updatePreviewScreenScales();
    this.renderMultiView(activeViewports);
    this.updateMouseCursorForFrame();
    this.renderDemandScheduler?.drawnRecord(this.frameCameras);
  }

  /**
   * Shape Editor repaint cursor path: after tools/widgets OnRender re-issue
   * SetMouseCursor, keep the last request for this frame or restore default.
   * Bounds hover / active-drag cursor re-issue happens in
   * BoxSelectTool.onRender via editorWindow onRepaint (onBeforeRender).
   */
  private updateMouseCursorForFrame(): void {
    this.transformHandler?.refreshBoundsHoverCursor();
    managerMouseCursor.update();
  }

  /**
   * Prepares and scissor-renders every active pane through the shared surface.
   *
   * @param viewports Active panes.
   */
  private renderMultiView(viewports: readonly ViewportEditor[]): void {
    if (!this.multiViewComposer || !this.sharedScene) return;
    this.syncMultiViewPasses(viewports);
    this.multiViewComposer.render(this.sharedScene.getScene(), this.multiViewPasses, Theme.separatorColor);
  }

  /**
   * Refreshes reusable pass slots for the active viewport list without
   * allocating pass objects or per-frame closures.
   *
   * @param viewports Active panes this frame.
   */
  private syncMultiViewPasses(viewports: readonly ViewportEditor[]): void {
    this.ensurePassPoolCount(viewports.length);
    this.multiViewPasses.length = viewports.length;
    for (let i = 0; i < viewports.length; i++) {
      const pass = this.multiViewPassPool[i]!;
      this.writePassFields(pass, viewports[i]!);
      this.multiViewPasses[i] = pass;
    }
  }

  /**
   * Grows the pass pool until it can hold the required number of panes. Pool
   * slots are never discarded when the active count shrinks.
   *
   * @param requiredCount Number of active panes.
   */
  private ensurePassPoolCount(requiredCount: number): void {
    while (this.multiViewPassPool.length < requiredCount) {
      this.multiViewPassPool.push(this.createPassSlot());
    }
  }

  /**
   * Creates one reusable pass with stable prepare/finalize/sync closures.
   *
   * @returns Pass slot owned by the loop.
   */
  private createPassSlot(): ReusableMultiViewPass {
    const pass = {} as ReusableMultiViewPass;
    pass.viewport = null as unknown as ViewportEditor;
    pass.camera = null as unknown as THREE.Camera;
    pass.contentElement = null as unknown as HTMLElement;
    pass.clearColor = Theme.viewportBackground;
    pass.syncCameraSize = (width: number, height: number) => {
      pass.viewport.resize(width, height);
    };
    pass.prepare = () => {
      this.prepareViewportPass(pass.viewport);
    };
    pass.finalize = () => {
      this.finalizeViewportPass(pass.viewport);
    };
    return pass;
  }

  /**
   * Updates camera, DOM and clear color fields for a pass slot from the live
   * viewport.
   *
   * @param pass Reusable pass slot.
   * @param viewport Source viewport for this pane.
   */
  private writePassFields(pass: ReusableMultiViewPass, viewport: ViewportEditor): void {
    pass.viewport = viewport;
    pass.camera = viewport.getCamera();
    pass.contentElement = viewport.getContentElement();
    pass.clearColor = viewport.getBackgroundColor();
  }

  /**
   * Prepares pane-local helpers and isolates this pane's CAD rulers.
   *
   * @param viewport Active multi-view pane.
   */
  private prepareViewportPass(viewport: ViewportEditor): void {
    this.cadRulerSystem?.prepareForCamera(viewport.getCamera());
    this.prepareGizmoScreenSpace(viewport);
    viewport.prepareRender();
  }

  /**
   * Sizes gizmo handles for the active pane camera only: bounds grips and
   * translate/rotate/scale clones. Each pane uses its own camera so 2D zoom
   * stays independent of 3D fly distance.
   *
   * @param viewport Active multi-view pane.
   */
  private prepareGizmoScreenSpace(viewport: ViewportEditor): void {
    if (!this.transformGizmo) return;
    if (typeof viewport.getGizmoGroup !== 'function') return;
    if (typeof viewport.getViewportKind !== 'function') return;
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
   * Hides pane-local helpers and shared-scene CAD rulers after the scissor
   * pass.
   *
   * @param viewport Active multi-view pane.
   */
  private finalizeViewportPass(viewport: ViewportEditor): void {
    const candidate = viewport as ViewportEditor & { endRenderPass?: () => void };
    candidate.endRenderPass?.();
    this.cadRulerSystem?.endCameraPass();
  }

  /**
   * Advances flying-camera simulation for every active perspective viewport.
   *
   * @param viewports Active viewports this frame.
   * @param delta Elapsed seconds.
   */
  private updatePerspectiveViewports(viewports: readonly ViewportEditor[], delta: number): void {
    for (let i = 0; i < viewports.length; i++) {
      const viewport = viewports[i];
      if (!viewport) continue;
      if (isPerspectiveViewport(viewport)) {
        viewport.update(delta);
      }
    }
  }

  /** Disconnects the viewport resize observer when present. */
  private disconnectResizeObserver(): void {
    if (!this.resizeObserver) return;
    this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }
}
