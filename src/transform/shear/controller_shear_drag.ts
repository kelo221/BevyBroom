import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { TransformMode } from '@/types/transform_mode.js';
import { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformProjectionMath } from '@/transform/core/transform_projection_math.js';
import { cloneOrientedBounds, type DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import { boundsFaceFromHandleRead, pickBoundsHandleFace } from '@/transform/bounds/bounds_face_pick.js';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { solidBrushPreviewSwap } from '@/solid/brush/solid_brush_preview_swap.js';
import {
  CommandSolidBrushesVertexMatrix,
  brushLocalMatrixCompose,
  type SolidBrushVertexMatrixEntry,
} from '@/solid/commands/brushes/command_solid_brushes_vertex_matrix.js';
import type { SolidBrushGeometryEditResult } from '@/solid/commands/brushes/command_solid_brushes_geometry_edit.js';
import { shearFaceAxisIndex, shearFaceSign, shearMatrixFromBoundsSlide } from '@/transform/shear/shear_matrix.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';

/** Snap tolerance below which a drag counts as no change. */
const SHEAR_ZERO_OFFSET_EPSILON = 1e-9;

/** One brush captured at shear drag start. */
interface ShearBrushSnapshot {
  /** Owning solid model. */
  model: SolidModel;
  /** Brush instance being sheared. */
  instance: SolidBrushInstance;
  /** Brush geometry before the drag. */
  brush: SolidBrush;
}

/** Services the shear drag needs to commit its result. */
export interface ControllerShearDragDeps {
  /** Undo stack. */
  commandStack: CommandStack;
  /** True while texture position lock keeps faces aligned. */
  isTexturePositionLockEnabled: () => boolean;
  /** Status line. */
  showStatusMessage: (message: string) => void;
}

/**
 * Shear tool interaction: dragging one side of the selection bounds slides that
 * side parallel to itself while the opposite side stays fixed. The drag applies
 * the shear matrix to solid brush vertices live and commits one undo step on
 * release.
 */
export class ControllerShearDrag {
  private readonly session: TransformDragSession;
  private readonly transformGizmo: GizmoTransform;
  private readonly gizmoRaycaster: GizmoRaycaster;
  private readonly transformExecutor: TransformExecutor;
  private readonly deps: ControllerShearDragDeps;
  private snapshots: ShearBrushSnapshot[];
  private slideDirectionWorld: THREE.Vector3;
  private initialMousePosition: THREE.Vector3 | null;
  private lastAppliedOffset: number;
  private shearActive: boolean;

  /**
   * Creates a shear drag controller bound to a shared drag session.
   *
   * @param session Shared drag session state.
   * @param transformGizmo The gizmo orchestrator.
   * @param gizmoRaycaster Raycaster for handle picking and plane projection.
   * @param transformExecutor Executor for grid snap queries.
   * @param deps Undo, texture lock, and status services.
   */
  constructor(
    session: TransformDragSession,
    transformGizmo: GizmoTransform,
    gizmoRaycaster: GizmoRaycaster,
    transformExecutor: TransformExecutor,
    deps: ControllerShearDragDeps,
  ) {
    this.session = session;
    this.transformGizmo = transformGizmo;
    this.gizmoRaycaster = gizmoRaycaster;
    this.transformExecutor = transformExecutor;
    this.deps = deps;
    this.snapshots = [];
    this.slideDirectionWorld = new THREE.Vector3();
    this.initialMousePosition = null;
    this.lastAppliedOffset = 0;
    this.shearActive = false;
  }

  /**
   * Returns whether a shear drag is running.
   *
   * @returns True while a shear drag is active.
   */
  isActive(): boolean {
    return this.shearActive;
  }

  /**
   * Starts a shear drag from a bounds side handle while Shear mode is armed.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param handles Current gizmo handles.
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane.
   * @returns True when a shear drag was started.
   */
  tryBegin(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): boolean {
    if (this.transformGizmo.getMode() !== TransformMode.SHEAR) {
      return false;
    }
    const picked = pickBoundsHandleFace(
      this.gizmoRaycaster,
      this.transformGizmo,
      camera,
      pickElement,
      event,
      handles,
      gizmoGroup,
      viewPlane,
    );
    const face = picked ? boundsFaceFromHandleRead(picked) : null;
    const bounds = this.transformGizmo.getCurrentBounds();
    if (!face || !bounds) {
      return false;
    }
    this.beginSession(camera, pickElement, event, selectedObjects, pivot, bounds, face, picked);
    return true;
  }

  /**
   * Captures the session state and brush snapshots for the drag.
   *
   * @param camera Viewport camera.
   * @param pickElement Element receiving the drag.
   * @param event Mouse event that started the drag.
   * @param selectedObjects Selected objects to shear.
   * @param pivot Drag pivot in world space.
   * @param bounds Selection bounds at drag start.
   * @param face Bounds face being dragged.
   * @param picked Picked gizmo handle, or null.
   */
  private beginSession(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    bounds: DataOrientedBounds,
    face: BoundsFace,
    picked: GizmoHandle | null,
  ): void {
    this.snapshots = this.snapshotsBuild(selectedObjects);
    if (this.snapshots.length === 0) {
      return;
    }
    this.sessionDragStateBegin(camera, pickElement, selectedObjects, pivot, bounds, face, picked);
    this.slideDirectionWorld = this.slideDirectionResolve(bounds, face, camera, event.altKey);
    this.initialMousePosition = this.faceCenterProjection(camera, pickElement, event, bounds, face);
    this.lastAppliedOffset = 0;
    this.shearActive = true;
    this.transformGizmo.setActiveHandle(picked);
    this.transformGizmo.setHighlightedBoundsFace(face);
    this.transformGizmo.setBoundsGuideLinesVisible(true);
  }

  /**
   * Stores the drag start state on the shared transform session.
   *
   * @param camera Viewport camera.
   * @param pickElement Element receiving the drag.
   * @param selectedObjects Selected objects to shear.
   * @param pivot Drag pivot in world space.
   * @param bounds Selection bounds at drag start.
   * @param face Bounds face being dragged.
   * @param picked Picked gizmo handle, or null.
   */
  private sessionDragStateBegin(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    bounds: DataOrientedBounds,
    face: BoundsFace,
    picked: GizmoHandle | null,
  ): void {
    this.session.snapshotPreDragState(selectedObjects);
    this.session.resetDragAccumulator();
    this.session.dragPivot.copy(pivot);
    this.session.dragActive = true;
    this.session.isBoundsResize = true;
    this.session.activeHandle = picked;
    this.session.activeBoundsFace = face;
    this.session.startBounds = cloneOrientedBounds(bounds);
    this.session.dragCamera = camera;
    this.session.dragRenderer = pickElement;
  }

  /**
   * Dispatches shear updates for the active drag.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   */
  handleMove(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent): void {
    if (
      !this.shearActive ||
      !this.initialMousePosition ||
      !this.session.startBounds ||
      !this.session.activeBoundsFace
    ) {
      return;
    }
    const plane = TransformProjectionMath.buildCameraPlane(camera, this.initialMousePosition);
    const current = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    if (!current) {
      return;
    }
    const rawOffset = current.clone().sub(this.initialMousePosition).dot(this.slideDirectionWorld);
    const snappedOffset = this.offsetSnap(rawOffset);
    if (Math.abs(snappedOffset - this.lastAppliedOffset) < SHEAR_ZERO_OFFSET_EPSILON) {
      return;
    }
    this.offsetApply(snappedOffset);
  }

  /**
   * Snaps a slide offset relative to the drag start.
   *
   * @param rawOffset Unsnapped slide distance.
   * @returns Snapped slide distance.
   */
  private offsetSnap(rawOffset: number): number {
    const gridSnap = this.transformExecutor.getGridSnap();
    if (!gridSnap.isEnabled()) {
      return rawOffset;
    }
    return gridSnap.snapValue(rawOffset);
  }

  /**
   * Applies one snapped slide offset to every snapshot, or refuses it.
   *
   * @param offset Snapped slide distance in world units.
   */
  private offsetApply(offset: number): void {
    const matrix = this.shearMatrixForOffset(offset);
    if (!matrix) {
      return;
    }
    const candidates = this.candidatesBuild(matrix);
    if (!candidates) {
      return;
    }
    this.candidatesApply(candidates);
    this.lastAppliedOffset = offset;
  }

  /**
   * Builds the world shear matrix for a slide offset of the active drag.
   *
   * @param offset Snapped slide distance in world units.
   * @returns Shear matrix, or null when the drag has no bounds or face.
   */
  private shearMatrixForOffset(offset: number): THREE.Matrix4 | null {
    const bounds = this.session.startBounds ?? this.transformGizmo.getCurrentBounds();
    const face = this.session.activeBoundsFace;
    if (!bounds || !face) {
      return null;
    }
    return shearMatrixFromBoundsSlide(bounds, face, this.slideDirectionWorld, offset);
  }

  /**
   * Builds sheared candidates for every snapshot.
   *
   * @param matrix World shear matrix.
   * @returns Candidates in snapshot order, or null when any would be invalid.
   */
  private candidatesBuild(matrix: THREE.Matrix4): SolidBrush[] | null {
    const candidates: SolidBrush[] = [];
    for (const snapshot of this.snapshots) {
      const candidate = snapshot.brush.clone();
      candidate.transformVertices(brushLocalMatrixCompose(snapshot.instance, matrix));
      if (!SolidBrushValidator.validate(candidate).valid) {
        return null;
      }
      candidates.push(candidate);
    }
    return candidates;
  }

  /**
   * Writes sheared candidates onto their instances.
   *
   * @param candidates Valid sheared brushes in snapshot order.
   */
  private candidatesApply(candidates: readonly SolidBrush[]): void {
    this.snapshots.forEach((snapshot, index) => {
      const candidate = candidates[index];
      if (candidate) {
        solidBrushPreviewSwap(snapshot.instance, candidate);
      }
    });
  }

  /** Commits the drag as one undo step and clears the session. */
  finishDrag(): void {
    if (!this.shearActive) {
      return;
    }
    this.snapshotsRestore();
    this.commitWhenOffsetApplied();
    this.shearActive = false;
  }

  /**
   * Pushes the undo command for the final offset when the drag changed
   * anything.
   */
  private commitWhenOffsetApplied(): void {
    if (Math.abs(this.lastAppliedOffset) < SHEAR_ZERO_OFFSET_EPSILON) {
      return;
    }
    const matrix = this.shearMatrixForOffset(this.lastAppliedOffset);
    if (!matrix) {
      return;
    }
    const command = new CommandSolidBrushesVertexMatrix(this.entriesBuild(matrix));
    this.deps.commandStack.push(command);
    this.deps.showStatusMessage(this.statusTextBuild(command.getEditResult()));
  }

  /**
   * Builds the command entries of every snapshot.
   *
   * @param matrix World shear matrix.
   * @returns Command entries.
   */
  private entriesBuild(matrix: THREE.Matrix4): SolidBrushVertexMatrixEntry[] {
    const lockTextures = this.deps.isTexturePositionLockEnabled();
    return this.snapshots.map((snapshot) => ({
      model: snapshot.model,
      brushId: snapshot.instance.id,
      matrix: matrix.clone(),
      lockTextures,
    }));
  }

  /**
   * Restores every snapshot geometry so the commit re-applies from a clean
   * state.
   */
  private snapshotsRestore(): void {
    this.snapshots.forEach((snapshot) => solidBrushPreviewSwap(snapshot.instance, snapshot.brush));
  }

  /**
   * Builds the commit status text.
   *
   * @param result Command result.
   * @returns Status message.
   */
  private statusTextBuild(result: SolidBrushGeometryEditResult): string {
    const skippedSuffix = result.skipped.length > 0 ? `, ${result.skipped.length} refused` : '';
    return `Sheared ${result.edited.length} brush(es)${skippedSuffix}`;
  }

  /**
   * Resolves the world slide direction of one bounds face.
   *
   * @param bounds Bounds at drag start.
   * @param face Face being sheared.
   * @param camera The viewport camera.
   * @param altHeld True when Alt requests the vertical slide.
   * @returns Unit world slide direction.
   */
  private slideDirectionResolve(
    bounds: DataOrientedBounds,
    face: BoundsFace,
    camera: THREE.Camera,
    altHeld: boolean,
  ): THREE.Vector3 {
    const faceAxis = shearFaceAxisIndex(face);
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    if (altHeld && faceAxis !== 1) {
      return new THREE.Vector3(0, 1, 0).applyQuaternion(bounds.quaternion).normalize();
    }
    return this.horizontalSlideLocal(bounds, faceAxis, cameraRight).applyQuaternion(bounds.quaternion).normalize();
  }

  /**
   * Picks the in-plane horizontal local axis closest to the camera right.
   *
   * @param bounds Bounds at drag start.
   * @param faceAxis Local axis index of the face.
   * @param cameraRight Camera right direction in world space.
   * @returns Unit local slide axis.
   */
  private horizontalSlideLocal(
    bounds: DataOrientedBounds,
    faceAxis: number,
    cameraRight: THREE.Vector3,
  ): THREE.Vector3 {
    let best = new THREE.Vector3(0, 0, 1);
    let bestAlignment = Number.NEGATIVE_INFINITY;
    for (const index of [0, 2]) {
      if (index === faceAxis) {
        continue;
      }
      const axisWorld = new THREE.Vector3().setComponent(index, 1).applyQuaternion(bounds.quaternion).normalize();
      const alignment = Math.abs(axisWorld.dot(cameraRight));
      if (alignment > bestAlignment) {
        bestAlignment = alignment;
        best = new THREE.Vector3().setComponent(index, 1);
      }
    }
    return best;
  }

  /**
   * Projects the pointer onto the camera plane through the face center.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param bounds Bounds at drag start.
   * @param face Face being sheared.
   * @returns Initial world mouse sample, or null when projection fails.
   */
  private faceCenterProjection(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    bounds: DataOrientedBounds,
    face: BoundsFace,
  ): THREE.Vector3 | null {
    const half = this.faceHalfExtent(bounds, face);
    const outward = this.faceWorldNormal(bounds, face);
    const faceCenter = bounds.center.clone().addScaledVector(outward, half);
    const plane = TransformProjectionMath.buildCameraPlane(camera, faceCenter);
    return this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
  }

  /**
   * Returns the half extent along a face axis.
   *
   * @param bounds Bounds at drag start.
   * @param face Bounds face.
   * @returns Half extent.
   */
  private faceHalfExtent(bounds: DataOrientedBounds, face: BoundsFace): number {
    return bounds.halfExtents.getComponent(shearFaceAxisIndex(face));
  }

  /**
   * Returns the world outward normal of a bounds face.
   *
   * @param bounds Bounds at drag start.
   * @param face Bounds face.
   * @returns Unit world normal.
   */
  private faceWorldNormal(bounds: DataOrientedBounds, face: BoundsFace): THREE.Vector3 {
    const local = new THREE.Vector3().setComponent(shearFaceAxisIndex(face), shearFaceSign(face));
    return local.applyQuaternion(bounds.quaternion).normalize();
  }

  /**
   * Collects shearable brush instances of a selection.
   *
   * @param selectedObjects Selected objects.
   * @returns Snapshots in selection order.
   */
  private snapshotsBuild(selectedObjects: readonly THREE.Object3D[]): ShearBrushSnapshot[] {
    const snapshots: ShearBrushSnapshot[] = [];
    for (const object of selectedObjects) {
      this.snapshotPush(snapshots, object);
    }
    return snapshots;
  }

  /**
   * Appends one object when it is an authored solid brush.
   *
   * @param snapshots Snapshot accumulator.
   * @param object Selected object.
   */
  private snapshotPush(snapshots: ShearBrushSnapshot[], object: THREE.Object3D): void {
    const model = SolidModel.fromObject(object);
    const instance = model?.findBrushByMesh(object);
    if (!model || !instance) {
      return;
    }
    snapshots.push({ model, instance, brush: instance.brush.clone() });
  }
}
