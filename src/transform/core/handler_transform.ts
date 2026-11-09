import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GizmoAxis, TransformMode, isBoundsWidgetMode } from '@/types/transform_mode.js';
import { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from './transform_executor.js';
import { TransformConstraint } from './transform_constraint.js';
import { CommandStack } from '@/commands/command_stack.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { TransformDragSession } from './session_transform_drag.js';
import { TransformProjectionMath } from './transform_projection_math.js';
import { ControllerBoundsDrag } from '@/transform/bounds/controller_bounds_drag.js';
import type { ControllerShearDrag } from '@/transform/shear/controller_shear_drag.js';
import { TransformCommandPusher } from './transform_command_pusher.js';
import { TransformModalHandlerIntegration } from '@/transform/modal/transform_modal_handler_integration.js';
import { ControllerRotateScaleDrag } from './controller_rotate_scale_drag.js';
import type { DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';

/**
 * Handles the drag interaction cycle for transform gizmo operations. Uses
 * absolute transforms from a pre-drag snapshot so results stay stable. Rotation
 * uses axis-plane angle measurement; scale uses distance ratios. During drags,
 * Blender-style X/Y/Z locks and numeric typing are routed through the modal
 * integration.
 */
export class HandlerTransform {
  private transformGizmo: GizmoTransform;
  private gizmoRaycaster: GizmoRaycaster;
  private transformExecutor: TransformExecutor;
  private session: TransformDragSession;
  private boundsDragController: ControllerBoundsDrag;
  private shearDragController: ControllerShearDrag | null;
  private commandPusher: TransformCommandPusher;
  private modalIntegration: TransformModalHandlerIntegration;
  private readonly rotateScaleDragController: ControllerRotateScaleDrag;
  private statusTextCallback: ((text: string) => void) | null;
  private afterDragVisualsCallback: ((objects: THREE.Object3D[]) => void) | null;

  /**
   * Creates a new transform handler.
   *
   * @param transformGizmo The gizmo orchestrator.
   * @param gizmoRaycaster The raycaster for handle picking.
   * @param transformExecutor The executor for applying transforms.
   * @param transformConstraint The constraint math utility (kept for API
   *   stability).
   * @param commandStack Optional command stack for undo/redo support.
   */
  constructor(
    transformGizmo: GizmoTransform,
    gizmoRaycaster: GizmoRaycaster,
    transformExecutor: TransformExecutor,
    _transformConstraint: TransformConstraint,
    commandStack: CommandStack | null = null,
  ) {
    this.transformGizmo = transformGizmo;
    this.gizmoRaycaster = gizmoRaycaster;
    this.shearDragController = null;
    this.transformExecutor = transformExecutor;
    this.session = new TransformDragSession();
    this.boundsDragController = new ControllerBoundsDrag(
      this.session,
      transformGizmo,
      gizmoRaycaster,
      transformExecutor,
    );
    this.commandPusher = new TransformCommandPusher(this.session, transformGizmo, transformExecutor, commandStack);
    this.modalIntegration = new TransformModalHandlerIntegration(
      Theme,
      this.session,
      transformGizmo,
      transformExecutor,
    );
    this.rotateScaleDragController = this.rotateScaleDragControllerCreate();
    this.statusTextCallback = null;
    this.afterDragVisualsCallback = null;
    this.wireModalIntegrationCallbacks();
  }

  /**
   * Creates the rotate and scale drag controller sharing this handler's
   * session, gizmo, raycaster, executor, modal lock and texture rebake.
   *
   * @returns Rotate and scale drag controller.
   */
  private rotateScaleDragControllerCreate(): ControllerRotateScaleDrag {
    return new ControllerRotateScaleDrag(this.session, {
      transformGizmo: this.transformGizmo,
      gizmoRaycaster: this.gizmoRaycaster,
      transformExecutor: this.transformExecutor,
      modalAxisRead: () => this.modalIntegration.getModalAxis(),
      rebakeLockedTextures: (objects, translationLike, scaleLike) =>
        this.boundsDragController.rebakeLockedTextures(objects, translationLike, scaleLike),
    });
  }

  /**
   * Sets a callback for modal status text (axis lock + typed value).
   *
   * @param callback Status text publisher, or null to clear.
   */
  setModalStatusTextCallback(callback: ((text: string) => void) | null): void {
    this.statusTextCallback = callback;
  }

  /**
   * Sets a callback invoked after modal commit/cancel so overlays and rulers
   * refresh without requiring another pointer event.
   *
   * @param callback Visual refresh hook, or null to clear.
   */
  setAfterDragVisualsCallback(callback: ((objects: THREE.Object3D[]) => void) | null): void {
    this.afterDragVisualsCallback = callback;
  }

  /**
   * Routes keyboard input during an active transform drag (X/Y/Z, digits,
   * Enter, Escape).
   *
   * @param event Browser keyboard event.
   * @returns True when the event was consumed by modal transform input.
   */
  handleModalKeyDown(event: KeyboardEvent): boolean {
    if (!this.session.dragActive) {
      return false;
    }
    return this.modalIntegration.handleKeyDown(event);
  }

  /**
   * Begins a single-use keyboard tool drag without a gizmo handle pick (G/R/S).
   *
   * @param mode Transform mode for the operation.
   * @param selectedObjects Drag targets.
   * @param pivot World pivot.
   * @param camera Active camera.
   * @param pickElement Pick element for NDC.
   * @param clientX Pointer client X at start.
   * @param clientY Pointer client Y at start.
   * @returns True when the single-use drag started.
   */
  beginSingleUseDrag(
    mode: TransformMode,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    camera: THREE.Camera,
    pickElement: HTMLElement,
    clientX: number,
    clientY: number,
  ): boolean {
    if (selectedObjects.length === 0) {
      return false;
    }
    this.commitActiveDragIfNeeded();
    this.prepareGizmoForSingleUseMode(mode);
    const syntheticEvent = this.createSyntheticMouseEvent(clientX, clientY);
    this.session.snapshotPreDragState(selectedObjects);
    this.session.resetDragAccumulator();
    this.transformExecutor.clearSnappedTranslationStepTracking();
    this.session.dragPivot.copy(pivot);
    this.session.dragActive = true;
    this.session.isSingleUseDrag = true;
    this.session.singleUseConfirmArmed = false;
    this.session.dragObjects = selectedObjects.slice();
    this.session.activeHandle = null;
    this.session.activeAxis = this.resolveSingleUseDefaultAxis(mode);
    this.session.dragCamera = camera;
    this.session.dragRenderer = pickElement as never;
    this.captureDragStartSample(camera, pickElement, syntheticEvent, pivot);
    this.modalIntegration.beginDrag();
    return true;
  }

  /**
   * Prepares gizmo mode for single-use math without showing handles (Shape
   * Editor and Blender hide transform widgets during G/R/S grab).
   *
   * @param mode Single-use transform mode.
   */
  private prepareGizmoForSingleUseMode(mode: TransformMode): void {
    this.transformGizmo.setMode(mode);
    this.transformGizmo.setVisible(false);
  }

  /**
   * Returns whether the active drag is a single-use keyboard tool session.
   *
   * @returns True during G/R/S style single-use.
   */
  isSingleUseDrag(): boolean {
    return this.session.dragActive && this.session.isSingleUseDrag;
  }

  /** Arms single-use confirm on LMB so the next pointer-up commits the edit. */
  armSingleUseConfirm(): void {
    if (!this.session.isSingleUseDrag) {
      return;
    }
    this.session.singleUseConfirmArmed = true;
  }

  /**
   * Returns whether single-use is waiting for pointer-up to commit.
   *
   * @returns True when LMB has armed confirm.
   */
  isSingleUseConfirmArmed(): boolean {
    return this.session.singleUseConfirmArmed;
  }

  /**
   * Chooses the default free axis for single-use mode without a handle pick.
   * Free G/R/S all start unconstrained (VIEW); X/Y/Z keyboard locks narrow
   * them.
   *
   * @param mode Transform mode.
   * @returns Default gizmo axis.
   */
  private resolveSingleUseDefaultAxis(_mode: TransformMode): GizmoAxis {
    return GizmoAxis.VIEW;
  }

  /**
   * Builds a minimal mouse event for pointer projection at client coordinates.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns Synthetic mouse event.
   */
  private createSyntheticMouseEvent(clientX: number, clientY: number): MouseEvent {
    return {
      clientX,
      clientY,
      button: 0,
      buttons: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as MouseEvent;
  }

  /**
   * Sets texture lock settings used when resizing or scaling meshes.
   *
   * @param settings Shared texture lock settings, or null to disable lock
   *   rebake.
   */
  setTextureLockSettings(settings: TextureLockSettings | null): void {
    this.boundsDragController.setTextureLockSettings(settings);
  }

  /**
   * Attaches the shear drag controller used while the Shear mode is active.
   *
   * @param controller Shear drag controller, or null to detach.
   */
  setShearDragController(controller: ControllerShearDrag | null): void {
    this.shearDragController = controller;
  }

  /**
   * Returns the shared drag session the shear controller binds to.
   *
   * @returns Drag session shared by all transform drag paths.
   */
  getDragSession(): TransformDragSession {
    return this.session;
  }

  /**
   * Returns the active transform gizmo mode.
   *
   * @returns Current TransformMode.
   */
  getMode(): TransformMode {
    return this.transformGizmo.getMode();
  }

  /**
   * Processes a pointer down event on the gizmo. Snapshots the pre-drag state
   * of selected objects for undo support.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param handles The current gizmo handles.
   * @param selectedObjects The selected meshes to snapshot.
   * @param pivot The transform pivot point for accurate projection.
   * @param gizmoGroup The viewport gizmo group for raycasting.
   * @param viewPlane View plane of the pane the pointer went down in.
   */
  onPointerDown(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    selectedObjects: THREE.Object3D[] = [],
    pivot: THREE.Vector3 = new THREE.Vector3(),
    gizmoGroup: THREE.Group = new THREE.Group(),
    viewPlane: CadViewPlane = 'xyz',
  ): void {
    if (this.isMultiSelectModifierHeld(event)) return;
    this.commitActiveDragIfNeeded();
    if (isBoundsWidgetMode(this.transformGizmo.getMode())) {
      const args = [camera, pickElement, event, handles, selectedObjects, pivot, gizmoGroup, viewPlane] as const;
      if (!this.shearDragController?.tryBegin(...args)) {
        this.boundsDragController.beginPointerDown(...args);
      }
      this.boundsWidgetDragModalBegin(selectedObjects);
      return;
    }
    const picked = this.gizmoRaycaster.pickHandle(handles, camera, pickElement, event, gizmoGroup);
    if (!picked) return;
    this.beginStandardHandleDrag(picked, camera, pickElement, event, selectedObjects, pivot);
  }

  /**
   * Starts modal keyboard handling for a bounds widget drag when a shear or
   * bounds drag began, keeping the dragged objects.
   *
   * @param selectedObjects Objects the drag moves.
   */
  private boundsWidgetDragModalBegin(selectedObjects: THREE.Object3D[]): void {
    if (!this.session.dragActive) {
      return;
    }
    this.session.dragObjects = selectedObjects.slice();
    this.modalIntegration.beginDrag();
  }

  /**
   * Returns true when the event is a multi-select click (Shift/Ctrl/Meta).
   * Those clicks must reach object selection rather than gizmo/bounds picks.
   * Shift is never used for bounds resize — it stays multi-select, fly boost,
   * and precision snap-off during drags.
   *
   * @param event The pointer event.
   * @returns True when multi-select modifiers are held.
   */
  private isMultiSelectModifierHeld(event: MouseEvent): boolean {
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  /**
   * Updates Bounds resize-handle hover (edge outline + CSS resize cursor) when
   * the pointer is idle.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane for orthographic cursor mapping.
   */
  updateBoundsHover(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): void {
    if (this.session.dragActive) return;
    if (!isBoundsWidgetMode(this.transformGizmo.getMode())) {
      this.clearBoundsHover(pickElement);
      return;
    }
    this.boundsDragController.updateFaceHoverHighlight(
      camera,
      pickElement,
      event,
      this.transformGizmo.getHandles(),
      gizmoGroup,
      viewPlane,
    );
  }

  /**
   * Clears bounds face/handle hover highlights and forgets the cached hover
   * cursor so the shared cursor manager restores the default next frame.
   *
   * @param _pickElement Unused; kept for call-site compatibility.
   */
  clearBoundsHover(_pickElement?: HTMLElement): void {
    this.transformGizmo.setHighlightedBoundsFaces([]);
    this.boundsDragController.clearHoverCursorCache();
  }

  /**
   * Re-issues the last bounds hover cursor for the current editor frame when
   * still valid. Call once per animation frame before the cursor manager
   * update.
   */
  refreshBoundsHoverCursor(): void {
    if (this.session.dragActive) {
      this.boundsDragController.reissueActiveDragCursor();
      return;
    }
    this.boundsDragController.refreshHoverCursor();
  }

  /**
   * Re-issues the bounds drag cursor while a handle is held (Shape Editor
   * active-gizmo UpdateMouseCursor on every repaint).
   */
  reissueBoundsDragCursor(): void {
    this.boundsDragController.reissueActiveDragCursor();
  }

  /**
   * Probes whether a standard gizmo handle is under the pointer without
   * starting a drag.
   *
   * @param camera Viewport camera.
   * @param pickElement Pick element for NDC.
   * @param event Pointer event.
   * @param handles Master handle list.
   * @param gizmoGroup Viewport gizmo group.
   * @returns True when a handle is hit.
   */
  probeHandleUnderPointer(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    gizmoGroup: THREE.Group,
  ): boolean {
    return this.gizmoRaycaster.pickHandle(handles, camera, pickElement, event, gizmoGroup) !== null;
  }

  /**
   * Probes whether a bounds handle, edge, or face is under the pointer without
   * starting a drag.
   *
   * @param camera Viewport camera.
   * @param pickElement Pick element for NDC.
   * @param event Pointer event.
   * @param handles Master handle list.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane for orthographic silhouette edges.
   * @returns True when a bounds control is hit.
   */
  probeBoundsControlUnderPointer(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): boolean {
    return this.boundsDragController.probeControlUnderPointer(
      camera,
      pickElement,
      event,
      handles,
      gizmoGroup,
      viewPlane,
    );
  }

  /**
   * Starts a standard translate/rotate/scale handle drag.
   *
   * @param picked The picked gizmo handle.
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   */
  private beginStandardHandleDrag(
    picked: GizmoHandle,
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
  ): void {
    this.session.snapshotPreDragState(selectedObjects);
    this.session.resetDragAccumulator();
    this.transformExecutor.clearSnappedTranslationStepTracking();
    this.session.dragPivot.copy(pivot);
    this.session.dragActive = true;
    this.session.dragObjects = selectedObjects.slice();
    this.session.activeHandle = picked;
    this.session.activeAxis = picked.getAxis();
    this.session.dragCamera = camera;
    this.session.dragRenderer = pickElement as never;
    this.transformGizmo.setActiveHandle(picked);
    this.captureDragStartSample(camera, pickElement, event, pivot);
    this.modalIntegration.beginDrag();
  }

  /**
   * Processes a pointer move event during drag.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot point.
   * @param selectedObjects The selected meshes to transform.
   */
  onPointerMove(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    _pivot: THREE.Vector3,
    selectedObjects: THREE.Object3D[],
  ): void {
    if (!this.session.dragActive) return;
    this.session.dragCamera = camera;
    this.session.dragRenderer = pickElement as never;
    if (this.session.dragObjects.length === 0) {
      this.session.dragObjects = selectedObjects.slice();
    }
    if (this.modalIntegration.hasTypedValue()) {
      return;
    }
    const mode = this.transformGizmo.getMode();
    if (isBoundsWidgetMode(mode) && !this.session.isSingleUseDrag) {
      if (this.shearDragController?.isActive()) {
        this.shearDragController.handleMove(camera, pickElement, event);
        return;
      }
      this.boundsDragController.handleMove(camera, pickElement, event, selectedObjects);
      return;
    }
    if (!this.session.activeAxis) return;
    if (!this.session.isSingleUseDrag && !this.session.activeHandle) return;
    if (mode === TransformMode.TRANSLATE || (this.session.isSingleUseDrag && mode === TransformMode.BOUNDS)) {
      this.handleTranslateMove(camera, pickElement, event, selectedObjects);
      return;
    }
    if (mode === TransformMode.ROTATE) {
      this.rotateScaleDragController.handleRotateMove(camera, pickElement, event, selectedObjects);
      return;
    }
    if (mode === TransformMode.SCALE) {
      this.rotateScaleDragController.handleScaleMove(camera, pickElement, event, selectedObjects);
    }
  }

  /**
   * Processes a pointer up event to end the drag and records its undo entry.
   *
   * @param pivot The transform pivot point used during the drag.
   * @param selectedObjects The selected meshes that were transformed.
   */
  onPointerUp(pivot: THREE.Vector3 = new THREE.Vector3(), selectedObjects: THREE.Object3D[] = []): void {
    if (this.session.dragActive) {
      this.shearDragController?.finishDrag();
      this.commandPusher.pushUndoCommand(pivot, selectedObjects);
    }
    this.finishDragInteraction();
  }

  /** Clears active handle, guide lines, modal keyboard state, and drag session. */
  private finishDragInteraction(): void {
    this.modalIntegration.endDrag();
    this.transformGizmo.setActiveHandle(null);
    this.transformGizmo.setBoundsGuideLinesVisible(false);
    this.transformGizmo.setHighlightedBoundsFaces([]);
    this.session.clearInteractionTargets();
  }

  /**
   * Restores object positions, rotations and scales from the pre-drag snapshot.
   *
   * @param selectedObjects Objects that may have been changed during the drag.
   */
  private restoreMeshesFromSnapshot(selectedObjects: THREE.Object3D[]): void {
    selectedObjects.forEach((object) => {
      const position = this.session.initialPositions.get(object);
      const quaternion = this.session.initialQuaternions.get(object);
      const scale = this.session.initialScales.get(object);
      if (position) object.position.copy(position);
      if (quaternion) object.quaternion.copy(quaternion);
      if (scale) object.scale.copy(scale);
    });
  }

  /**
   * Returns whether a drag operation is currently in progress.
   *
   * @returns True if dragging is active.
   */
  isDragging(): boolean {
    return this.session.dragActive;
  }

  /**
   * Commits the active drag (push undo from the pre-drag snapshot) when one is
   * running. Used before starting a new drag and when focus is lost so the
   * original pose remains undoable.
   */
  commitActiveDragIfNeeded(): void {
    if (!this.session.dragActive) {
      return;
    }
    this.commitModalDrag();
  }

  /** Cancels the active drag and restores pre-drag poses without pushing undo. */
  cancelActiveDragIfNeeded(): void {
    if (!this.session.dragActive) {
      return;
    }
    this.cancelModalDrag();
  }

  /**
   * Returns the accumulated world-space translation delta for the active drag.
   *
   * @returns A clone of the drag delta accumulator.
   */
  getDragDelta(): THREE.Vector3 {
    return this.session.dragDeltaAccumulator.clone();
  }

  /**
   * Returns the oriented bounds captured at the start of a bounds drag.
   *
   * @returns Cloned start bounds, or null when unavailable.
   */
  getDragStartBounds(): DataOrientedBounds | null {
    if (!this.session.startBounds) return null;
    return {
      center: this.session.startBounds.center.clone(),
      quaternion: this.session.startBounds.quaternion.clone(),
      halfExtents: this.session.startBounds.halfExtents.clone(),
    };
  }

  /**
   * Returns the pivot point captured when the drag began.
   *
   * @returns A clone of the drag pivot.
   */
  getDragPivot(): THREE.Vector3 {
    return this.session.dragPivot.clone();
  }

  /**
   * Returns whether the active drag is a bounds one-sided resize.
   *
   * @returns True during bounds resize.
   */
  isBoundsResizeDrag(): boolean {
    return this.session.dragActive && this.session.isBoundsResize;
  }

  /**
   * Returns whether the active drag is a pure translation (move handle or
   * bounds face slide).
   *
   * @returns True when translation deltas should drive CAD rulers.
   */
  isTranslationDrag(): boolean {
    if (!this.session.dragActive) return false;
    if (this.session.isBoundsResize) return false;
    return true;
  }

  /**
   * Returns the currently active gizmo axis.
   *
   * @returns The active GizmoAxis, or null if not dragging.
   */
  getActiveAxis(): GizmoAxis | null {
    return this.session.activeAxis;
  }

  /**
   * Checks if the handler is currently busy with a drag.
   *
   * @returns True if the handler should consume events.
   */
  isBusy(): boolean {
    return this.session.dragActive;
  }

  /**
   * Captures the mode-specific start sample used during drag.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot.
   */
  private captureDragStartSample(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    pivot: THREE.Vector3,
  ): void {
    const mode = this.transformGizmo.getMode();
    if (mode === TransformMode.TRANSLATE) {
      this.captureTranslateStart(camera, pickElement, event, pivot);
      return;
    }
    if (mode === TransformMode.ROTATE) {
      this.rotateScaleDragController.captureRotateStart(camera, pickElement, event, pivot);
      return;
    }
    if (mode === TransformMode.SCALE) {
      this.rotateScaleDragController.captureScaleStart(camera, pickElement, event, pivot);
    }
  }

  /**
   * Stores the initial plane intersection for translation.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param pivot The transform pivot.
   */
  private captureTranslateStart(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    pivot: THREE.Vector3,
  ): void {
    const plane = TransformProjectionMath.buildCameraPlane(camera, pivot);
    this.session.initialMousePosition = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
  }

  /**
   * Applies translation from drag start using camera-plane mouse delta.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param objects The meshes to translate.
   */
  private handleTranslateMove(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    objects: THREE.Object3D[],
  ): void {
    if (!this.session.initialMousePosition) return;
    const plane = TransformProjectionMath.buildCameraPlane(camera, this.session.dragPivot);
    const currentMouse = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    if (!currentMouse) return;
    const totalDelta = currentMouse.clone().sub(this.session.initialMousePosition);
    this.session.lastPointerWorldDelta.copy(totalDelta);
    const constrainedDelta = this.modalIntegration.constrainTranslationDelta(totalDelta);
    this.session.dragDeltaAccumulator.copy(constrainedDelta);
    this.transformExecutor.applyAbsoluteTranslation(objects, this.session.initialPositions, constrainedDelta);
    this.boundsDragController.rebakeLockedTextures(objects, true, false);
  }

  /** Wires modal controller callbacks for commit, cancel, status, and re-apply. */
  private wireModalIntegrationCallbacks(): void {
    this.modalIntegration.setCallbacks({
      commitDrag: () => this.commitModalDrag(),
      cancelDrag: () => this.cancelModalDrag(),
      rebakeTextures: (objects, translationLike, scaleLike) =>
        this.boundsDragController.rebakeLockedTextures(objects, translationLike, scaleLike),
      setStatusText: (text) => this.statusTextCallback?.(text),
      reapplyMouseDrivenTransform: () => this.reapplyMouseDrivenTransform(),
    });
  }

  /** Commits the active drag from keyboard Enter without a pointer-up event. */
  private commitModalDrag(): void {
    if (!this.session.dragActive) return;
    const objects = this.session.dragObjects.slice();
    const pivot = this.session.dragPivot.clone();
    this.commandPusher.pushUndoCommand(pivot, objects);
    this.finishDragInteraction();
    this.afterDragVisualsCallback?.(objects);
  }

  /** Cancels the active drag from keyboard Escape without pushing undo. */
  private cancelModalDrag(): void {
    if (!this.session.dragActive) return;
    const objects = this.session.dragObjects.slice();
    this.restoreMeshesFromSnapshot(objects);
    this.finishDragInteraction();
    this.afterDragVisualsCallback?.(objects);
  }

  /** Re-applies the last pointer-driven sample after modal axis or buffer edits. */
  private reapplyMouseDrivenTransform(): void {
    const objects = this.session.dragObjects;
    if (objects.length === 0) return;
    const mode = this.transformGizmo.getMode();
    if (mode === TransformMode.TRANSLATE) {
      this.modalIntegration.reapplyLastPointerTranslation(objects);
      return;
    }
    if (mode === TransformMode.ROTATE) {
      this.modalIntegration.reapplyLastPointerRotation(objects);
      return;
    }
    if (mode === TransformMode.SCALE) {
      this.modalIntegration.reapplyLastPointerScale(objects);
      return;
    }
    this.reapplyBoundsMouseDrivenTransform(objects);
  }

  /**
   * Re-applies the last bounds pointer sample with the current modal lock.
   *
   * @param objects Drag targets.
   */
  private reapplyBoundsMouseDrivenTransform(objects: THREE.Object3D[]): void {
    if (this.session.isBoundsResize) {
      this.boundsDragController.applyResizeDelta(
        objects,
        this.session.lastPointerBoundsResizeDelta,
        this.session.lastPointerSecondaryBoundsResizeDelta,
      );
      return;
    }
    this.modalIntegration.reapplyLastPointerTranslation(objects);
  }
}
