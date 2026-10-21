import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import {
  applyGridSnapPrecisionFromShift,
  restoreGridSnapUserPreference,
} from '@/transform/snap/grid_snap_shift_precision.js';
import type { TransformExecutor } from '@/transform/core/transform_executor.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { restoreTransformTextureState } from '@/transform/commands/state_transform_texture.js';
import {
  publishLayoutTransformLiveVisuals,
  type LayoutTransformLiveVisualsCallbacks,
} from '@/layout/setup/layout_transform_live_visuals.js';
import { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';
import type { ObjectDragPointerSample } from '@/tools/object_drag/object_drag_pointer_sample.js';
import type { ObjectDragViewport } from '@/tools/object_drag/object_drag_viewport.js';
import type { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { objectDragAnchorPointResolve } from '@/tools/object_drag/object_drag_anchor_point.js';
import { ObjectDragMovePhase, type ObjectDragMoveConstraintKind } from './object_drag_move_plane.js';

/** Selection members a move session reads and restores. */
export interface ObjectDragMoveSelection {
  getAllSelectedObjectsAsArray(): THREE.Mesh[];
  getInspectorObjects(): THREE.Object3D[];
  setSelection(meshes: THREE.Mesh[], inspectorObjects?: THREE.Object3D[]): boolean;
}

/** Editor systems a selection move works with. */
export interface ObjectDragMoveSessionDeps {
  /** Viewport under the drag. */
  viewport: ObjectDragViewport;
  /** Working grid frame (its normal is "up" for 3D moves). */
  gridFrame: ObjectDragGridFrame;
  /** Shared grid snap (Shift temporarily disables it). */
  gridSnap: GridSnap;
  /**
   * Returns the user's grid snap preference.
   *
   * @returns True when snapping is wanted without Shift.
   */
  userSnapEnabledRead: () => boolean;
  /** Applies snapped translations to the drag targets. */
  transformExecutor: TransformExecutor;
  /** Undo history; duplicate and move share one entry. */
  commandStack: CommandStack;
  /** Selection state. */
  selection: ObjectDragMoveSelection;
  /**
   * Returns the unlocked objects that receive the move.
   *
   * @returns Transform targets of the current selection.
   */
  transformTargetsResolve: () => THREE.Object3D[];
  /**
   * Duplicates hierarchy objects and selects the copies.
   *
   * @param objects Objects to duplicate.
   */
  duplicateHierarchyObjects: (objects: THREE.Object3D[]) => void;
  /**
   * Pushes the translate undo command for moved targets.
   *
   * @param dragSession Pre-drag snapshot of the targets.
   * @param targets Moved objects.
   */
  translateUndoPush: (dragSession: TransformDragSession, targets: THREE.Object3D[]) => void;
  /**
   * Rebakes locked textures after meshes moved.
   *
   * @param meshes Moved meshes.
   */
  textureLockRebake: (meshes: THREE.Mesh[]) => void;
  /** Live solid, outline and ruler feedback sinks. */
  liveVisuals: LayoutTransformLiveVisualsCallbacks;
  /**
   * Finishes a committed move (visual refresh after transform).
   *
   * @param targets Moved objects.
   */
  afterCommit: (targets: THREE.Object3D[]) => void;
  /** Refreshes the editor after a cancelled move. */
  afterCancel: () => void;
}

/** Press details that start a selection move. */
export interface ObjectDragMoveRequest {
  /** Press client X. */
  pressClientX: number;
  /** Press client Y. */
  pressClientY: number;
  /** Selected mesh that was pressed. */
  pressedMesh: THREE.Mesh;
  /** True to duplicate the selection and move the copies. */
  duplicate: boolean;
  /** True when Alt was held at the press. */
  altKey: boolean;
}

/**
 * Moves the selection with the mouse. The perspective view moves on the
 * horizontal grid plane through the pressed point, or along the grid normal
 * while Alt is held; 2D views move in the view plane. The movement snaps to
 * grid steps relative to the start unless Shift is held.
 */
export class ObjectDragMoveSession extends ObjectDragSession {
  private readonly deps: ObjectDragMoveSessionDeps;
  private readonly transaction: CommandStackTransaction;
  private readonly originalSelectedMeshes: THREE.Mesh[];
  private readonly originalInspectorObjects: THREE.Object3D[];
  private readonly duplicated: boolean;
  private readonly targets: THREE.Object3D[];
  private readonly dragSession = new TransformDragSession();
  private readonly pressPoint: THREE.Vector3;
  private readonly committedDelta = new THREE.Vector3();
  private readonly lastTotalDelta = new THREE.Vector3();
  private phase: ObjectDragMovePhase | null = null;

  /**
   * Starts a move (duplicating first when requested) and captures the targets.
   *
   * @param deps Editor systems for the session.
   * @param request Press details.
   */
  constructor(deps: ObjectDragMoveSessionDeps, request: ObjectDragMoveRequest) {
    super();
    this.deps = deps;
    this.transaction = new CommandStackTransaction(deps.commandStack);
    this.originalSelectedMeshes = deps.selection.getAllSelectedObjectsAsArray();
    this.originalInspectorObjects = deps.selection.getInspectorObjects();
    this.duplicated = request.duplicate && this.selectionDuplicate();
    this.targets = deps.transformTargetsResolve();
    this.dragSession.snapshotPreDragState(this.targets);
    deps.transformExecutor.clearSnappedTranslationStepTracking();
    this.pressPoint = this.pressPointResolve(request);
    const pressRay = deps.viewport.rayAtClientPoint(request.pressClientX, request.pressClientY);
    this.phaseRestart(this.constraintKindFor(request.altKey), pressRay);
    deps.liveVisuals.onRulerTransformFeedback?.(this.selectedMeshes(), 'begin');
  }

  /**
   * Returns the objects that receive the move.
   *
   * @returns Transform targets.
   */
  moveTargets(): readonly THREE.Object3D[] {
    return this.targets;
  }

  /**
   * Moves the targets for a pointer sample.
   *
   * @param sample Current pointer position and modifier keys.
   */
  protected sessionUpdate(sample: ObjectDragPointerSample): void {
    applyGridSnapPrecisionFromShift(this.deps.gridSnap, sample.shiftKey, this.deps.userSnapEnabledRead());
    const ray = this.deps.viewport.rayAtClientPoint(sample.clientX, sample.clientY);
    const wantedKind = this.constraintKindFor(sample.altKey);
    if (!this.phase || this.phase.kind() !== wantedKind) {
      this.phaseRestart(wantedKind, ray);
    }
    const phaseDelta = this.phase ? this.phase.deltaAt(ray) : null;
    if (!phaseDelta) {
      return;
    }
    this.lastTotalDelta.copy(this.committedDelta).add(phaseDelta);
    this.targetsTranslate(this.lastTotalDelta);
  }

  /** Records one undo entry for the duplicate and the move. */
  protected sessionCommit(): void {
    restoreGridSnapUserPreference(this.deps.gridSnap, this.deps.userSnapEnabledRead());
    this.deps.translateUndoPush(this.dragSession, this.targets);
    this.transaction.commit();
    this.deps.liveVisuals.onRulerTransformFeedback?.(this.selectedMeshes(), 'end');
    this.deps.afterCommit(this.targets);
  }

  /** Puts the targets back, removes duplicates and restores the selection. */
  protected sessionCancel(): void {
    restoreGridSnapUserPreference(this.deps.gridSnap, this.deps.userSnapEnabledRead());
    this.targetsRestore();
    this.deps.liveVisuals.onRulerTransformFeedback?.(this.selectedMeshes(), 'end');
    this.transaction.rollback();
    if (this.duplicated) {
      this.deps.selection.setSelection(this.originalSelectedMeshes, this.originalInspectorObjects);
    }
    this.deps.afterCancel();
  }

  /**
   * Duplicates the current selection so the copies become the selection.
   *
   * @returns True when copies were created.
   */
  private selectionDuplicate(): boolean {
    const sources =
      this.originalInspectorObjects.length > 0 ? this.originalInspectorObjects : this.originalSelectedMeshes;
    if (sources.length === 0) {
      return false;
    }
    const topBeforeDuplicate = this.deps.commandStack.peekUndo();
    this.deps.duplicateHierarchyObjects([...sources]);
    return this.deps.commandStack.peekUndo() !== topBeforeDuplicate;
  }

  /**
   * Resolves the world point that was pressed on the selected mesh.
   *
   * @param request Press details.
   * @returns World press point.
   */
  private pressPointResolve(request: ObjectDragMoveRequest): THREE.Vector3 {
    const anchor = objectDragAnchorPointResolve(
      this.deps.viewport,
      this.deps.gridFrame,
      request.pressClientX,
      request.pressClientY,
      [request.pressedMesh],
    );
    return anchor.point;
  }

  /**
   * Returns the constraint for the current Alt state: a vertical line in the
   * perspective view while Alt is held, otherwise a plane.
   *
   * @param altKey True while Alt is held.
   * @returns Constraint kind.
   */
  private constraintKindFor(altKey: boolean): ObjectDragMoveConstraintKind {
    return altKey && this.deps.viewport.isPerspective() ? 'line' : 'plane';
  }

  /**
   * Starts a new phase from the current snapped offset so the selection stays
   * where it is.
   *
   * @param constraintKind Constraint of the new phase.
   * @param ray Pick ray at the restart.
   */
  private phaseRestart(constraintKind: ObjectDragMoveConstraintKind, ray: THREE.Ray): void {
    this.committedDelta.copy(this.lastTotalDelta);
    this.deps.gridSnap.snapVector3(this.committedDelta);
    const anchor = this.pressPoint.clone().add(this.committedDelta);
    const perspective = this.deps.viewport.isPerspective();
    const axis = perspective ? this.deps.gridFrame.normalWorld() : this.deps.viewport.cameraForwardWorld();
    this.phase = ObjectDragMovePhase.phaseBegin(constraintKind, anchor, axis, ray, perspective);
  }

  /**
   * Places every target at its start plus a shared snapped delta and publishes
   * live visuals.
   *
   * @param totalDelta Unsnapped world delta from the start.
   */
  private targetsTranslate(totalDelta: THREE.Vector3): void {
    this.deps.transformExecutor.applyAbsoluteTranslation(this.targets, this.dragSession.initialPositions, totalDelta);
    this.deps.textureLockRebake(this.targetMeshes());
    publishLayoutTransformLiveVisuals(this.deps.liveVisuals, {
      selectedMeshes: this.selectedMeshes(),
      transformTargets: this.targets,
    });
  }

  /** Writes back the start positions and textures of every target. */
  private targetsRestore(): void {
    for (const target of this.targets) {
      const startPosition = this.dragSession.initialPositions.get(target);
      if (startPosition) {
        target.position.copy(startPosition);
      }
    }
    restoreTransformTextureState(this.dragSession.initialTextureState);
    publishLayoutTransformLiveVisuals(this.deps.liveVisuals, {
      selectedMeshes: this.selectedMeshes(),
      transformTargets: this.targets,
    });
  }

  /**
   * Returns the mesh targets.
   *
   * @returns Targets that are meshes.
   */
  private targetMeshes(): THREE.Mesh[] {
    return this.targets.filter((target): target is THREE.Mesh => target instanceof THREE.Mesh);
  }

  /**
   * Returns the currently selected meshes.
   *
   * @returns Selected meshes.
   */
  private selectedMeshes(): THREE.Mesh[] {
    return this.deps.selection.getAllSelectedObjectsAsArray();
  }
}
