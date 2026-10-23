import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { CommandTextureFaceApply } from '@/texture/commands/command_texture_face_apply.js';
import {
  buildTargetsFromFaceSelection,
  buildTargetsFromMeshes,
  resolveTargetMapping,
  TextureApplyTarget,
} from '@/texture/uv/face_texture_applier.js';
import { createDefaultFaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperation } from '@/texture/uv/operations/face_uv_operation.js';
import type { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import {
  FaceUvCameraDirections,
  createWorldPolygonTargetContextFactory,
} from '@/texture/uv/operations/face_uv_operation_context_factory.js';
import { FaceUvOperationStatus } from '@/texture/uv/operations/face_uv_operation_status.js';
import { faceUvRowDirection, faceUvRowMagnitude } from '@/texture/uv/operations/face_uv_operation_math.js';
import { FaceUvOperationFit, type FaceUvFitAxis } from '@/texture/uv/operations/face_uv_operation_fit.js';
import { FaceUvOperationJustify, type FaceUvJustifySide } from '@/texture/uv/operations/face_uv_operation_justify.js';
import {
  FaceUvOperationAlignEdge,
  type FaceUvAlignEdgeMode,
} from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import { FaceUvOperationFlip, type FaceUvFlipAxis } from '@/texture/uv/operations/face_uv_operation_flip.js';
import { FaceUvOperationRotate } from '@/texture/uv/operations/face_uv_operation_rotate.js';
import { FaceUvOperationShear, type FaceUvShearMode } from '@/texture/uv/operations/face_uv_operation_shear.js';
import {
  FaceUvOperationOffsetNudge,
  type FaceUvNudgeDirection,
} from '@/texture/uv/operations/face_uv_operation_offset_nudge.js';
import { FaceUvOperationScale } from '@/texture/uv/operations/face_uv_operation_scale.js';
import { FaceUvOperationResetWorld } from '@/texture/uv/operations/face_uv_operation_reset_world.js';
import { FaceUvOperationResetFace } from '@/texture/uv/operations/face_uv_operation_reset_face.js';
import { faceUvNudgeStepResolve, faceUvRotateStepResolve, type FaceUvToolModifiers } from './face_uv_tool_steps.js';

/** Rotation fallback in degrees when the grid angle is unusable. */
const FACE_UV_ROTATE_FALLBACK_DEGREES = 15;

/** Status flags of a single selected face used for UI highlighting. */
export interface FaceUvToolSelectionStatus {
  fittedU: boolean;
  fittedV: boolean;
  justifiedLeft: boolean;
  justifiedRight: boolean;
  justifiedTop: boolean;
  justifiedBottom: boolean;
  justifiedCenter: boolean;
  aligned: boolean;
}

/** Callback for status messages. */
export type FaceUvToolsStatusCallback = (message: string) => void;

/** Source of the current camera directions, or null when unavailable. */
export type FaceUvCameraDirectionsProvider = () => FaceUvCameraDirections | null;

/** Source of the current modifier state. */
export type FaceUvModifiersProvider = () => FaceUvToolModifiers;

/**
 * Drives the pure face UV operations (fit, justify, align, flip, rotate, shear,
 * nudge, scale, resets) for the current face or object selection, one undoable
 * command per invocation.
 */
export class ControllerFaceUvTools {
  private selectionManager: ManagerSelection;
  private faceExtrusionController: ControllerFaceExtrusion;
  private commandStack: CommandStack;
  private gridSnap: GridSnap;
  private cameraDirectionsProvider: FaceUvCameraDirectionsProvider;
  private modifiersProvider: FaceUvModifiersProvider;
  private statusCallback: FaceUvToolsStatusCallback | null;
  private afterEditCallback: (() => void) | null;

  /**
   * Creates the face UV tools controller.
   *
   * @param selectionManager Object selection manager.
   * @param faceExtrusionController Face selection / mode owner.
   * @param commandStack Undo stack.
   * @param gridSnap Grid snap providing nudge and rotation steps.
   * @param cameraDirectionsProvider Supplies camera right/up, or null.
   * @param modifiersProvider Supplies the current Shift/Ctrl state.
   */
  constructor(
    selectionManager: ManagerSelection,
    faceExtrusionController: ControllerFaceExtrusion,
    commandStack: CommandStack,
    gridSnap: GridSnap,
    cameraDirectionsProvider: FaceUvCameraDirectionsProvider,
    modifiersProvider: FaceUvModifiersProvider,
  ) {
    this.selectionManager = selectionManager;
    this.faceExtrusionController = faceExtrusionController;
    this.commandStack = commandStack;
    this.gridSnap = gridSnap;
    this.cameraDirectionsProvider = cameraDirectionsProvider;
    this.modifiersProvider = modifiersProvider;
    this.statusCallback = null;
    this.afterEditCallback = null;
  }

  /**
   * Registers a status message callback.
   *
   * @param callback Status handler, or null.
   */
  setStatusCallback(callback: FaceUvToolsStatusCallback | null): void {
    this.statusCallback = callback;
  }

  /**
   * Registers a callback run after each committed edit.
   *
   * @param callback Refresh hook, or null.
   */
  setAfterEditCallback(callback: (() => void) | null): void {
    this.afterEditCallback = callback;
  }

  /**
   * Fits the texture repeats across the face along one axis choice.
   *
   * @param axis Axis or axes to fit.
   */
  fit(axis: FaceUvFitAxis): void {
    this.operationApply(new FaceUvOperationFit({ axis }), `Fitted texture (${axis})`);
  }

  /**
   * Justifies the texture onto the tile grid on one face side.
   *
   * @param side Side pulled onto the grid.
   */
  justify(side: FaceUvJustifySide): void {
    this.operationApply(new FaceUvOperationJustify(side), `Justified texture (${side})`);
  }

  /**
   * Aligns the U axis with a face edge.
   *
   * @param mode Best edge or a step from the aligned one.
   */
  alignEdge(mode: FaceUvAlignEdgeMode): void {
    this.operationApply(new FaceUvOperationAlignEdge(mode), `Aligned texture to edge (${mode})`);
  }

  /**
   * Mirrors the texture along a screen axis.
   *
   * @param axis Horizontal or vertical screen axis.
   */
  flip(axis: FaceUvFlipAxis): void {
    this.operationApply(new FaceUvOperationFlip(axis), `Flipped texture ${axis === 'horizontal' ? 'H' : 'V'}`);
  }

  /**
   * Rotates the texture by whole degrees.
   *
   * @param degrees Rotation angle.
   */
  rotate(degrees: number): void {
    this.operationApply(new FaceUvOperationRotate(degrees), `Rotated texture ${degrees}°`);
  }

  /**
   * Rotates by the grid angle resolved from the current modifiers.
   *
   * @param direction 1 for counter-clockwise, -1 for clockwise.
   */
  rotateByGridStep(direction: number): void {
    const gridDegrees = this.gridSnap.getRotationSnapDegrees();
    const modifiers = this.modifiersProvider();
    const step = faceUvRotateStepResolve(gridDegrees, modifiers);
    this.rotate(direction * (step > 0 && Number.isFinite(step) ? step : FACE_UV_ROTATE_FALLBACK_DEGREES));
  }

  /**
   * Shears the texture frame by a factor delta.
   *
   * @param mode Which coordinate shears.
   * @param factor Shear factor delta.
   */
  shear(mode: FaceUvShearMode, factor: number): void {
    this.operationApply(new FaceUvOperationShear(mode, factor), `Sheared texture (${mode})`);
  }

  /**
   * Applies an absolute shear target typed into a field: the delta from the
   * selection's shared current factor. A mixed selection shears from zero.
   *
   * @param mode Which coordinate shears.
   * @param targetFactor Absolute factor typed into the field, or null to skip.
   */
  shearFromField(mode: FaceUvShearMode, targetFactor: number | null): void {
    if (targetFactor === null || !Number.isFinite(targetFactor)) {
      return;
    }
    const current = this.readSharedShear(mode) ?? 0;
    this.shear(mode, targetFactor - current);
  }

  /**
   * Nudges the texture toward a screen direction by the modifier-resolved step.
   *
   * @param direction Screen direction of the movement.
   */
  nudgeOffset(direction: FaceUvNudgeDirection): void {
    const step = faceUvNudgeStepResolve(this.gridSnap.getInterval(), this.modifiersProvider());
    this.operationApply(new FaceUvOperationOffsetNudge(direction, step), `Nudged texture ${direction}`);
  }

  /**
   * Multiplies the texture scale per axis about the face UV center.
   *
   * @param factorU U axis multiplier.
   * @param factorV V axis multiplier.
   */
  scale(factorU: number, factorV: number): void {
    this.operationApply(new FaceUvOperationScale(factorU, factorV), 'Scaled texture');
  }

  /** Rebuilds the UVs on the world-axis-snapped projection plane. */
  resetToWorld(): void {
    this.operationApply(new FaceUvOperationResetWorld(), 'Reset texture to world alignment');
  }

  /** Rebuilds the UVs on the face's own projection plane. */
  resetToFace(): void {
    this.operationApply(new FaceUvOperationResetFace(), 'Reset texture to face alignment');
  }

  /**
   * Returns whether face mode is active with at least one selected face, the
   * gate every keyboard shortcut checks before running.
   *
   * @returns True while the UV shortcuts may act.
   */
  faceModeHasSelectedFaces(): boolean {
    if (this.faceExtrusionController.getSelectionMode() !== SelectionMode.FACE) {
      return false;
    }
    return this.faceExtrusionController.getSelectedFaceCount() > 0;
  }

  /**
   * Reads the UV status flags of the selection for UI highlighting. Only a
   * single selected face region reports flags.
   *
   * @returns Status flags, or null when the selection is not one region.
   */
  readSelectionStatus(): FaceUvToolSelectionStatus | null {
    const resolved = this.singleFaceRegionResolve();
    if (!resolved) {
      return null;
    }
    return this.statusReadForMapping(resolved.mapping.uv, resolved.context);
  }

  /**
   * Reads the shared shear factor of the selection, or null when mixed.
   *
   * @param mode Which coordinate's shear is read.
   * @returns Shared shear factor, or null.
   */
  readSharedShear(mode: FaceUvShearMode): number | null {
    const values = this.collectTargets().map((target) => faceShearFactorRead(resolveTargetMapping(target).uv, mode));
    const first = values[0];
    if (first === undefined) {
      return null;
    }
    return values.every((value) => Math.abs(value - first) <= 1e-4) ? first : null;
  }

  /**
   * Applies one operation to the current targets as a single undo step.
   *
   * @param operation Operation to apply.
   * @param statusMessage Status text on success.
   */
  private operationApply(operation: FaceUvOperation, statusMessage: string): void {
    const targets = this.collectTargets();
    if (targets.length === 0) {
      this.statusCallback?.('Select face(s) in Face mode, or object(s) in Object mode');
      return;
    }
    const command = new CommandTextureFaceApply(targets, createDefaultFaceTextureMapping(), {
      matrixOperation: operation,
      matrixOperationContextFactory: createWorldPolygonTargetContextFactory(this.cameraDirectionsProvider()),
    });
    this.commandStack.push(command);
    this.statusCallback?.(`${statusMessage} on ${targets.length} face region(s)`);
    this.afterEditCallback?.();
  }

  /**
   * Collects texture targets from the face selection or whole objects.
   *
   * @returns Apply targets, with bevel volumes left out.
   */
  private collectTargets(): TextureApplyTarget[] {
    if (this.faceExtrusionController.getSelectionMode() !== SelectionMode.FACE) {
      return buildTargetsFromMeshes(this.editableSelectedMeshes());
    }
    const faces = this.faceExtrusionController.getSelectedFaces();
    const editable = faces.filter((face) => !ModifierVolumeBevel.isVolume(face.mesh));
    if (editable.length === 0) {
      return [];
    }
    return buildTargetsFromFaceSelection(editable);
  }

  /**
   * Returns selected meshes that accept UV edits.
   *
   * @returns Selected meshes excluding bevel volumes.
   */
  private editableSelectedMeshes(): THREE.Mesh[] {
    return this.selectionManager.getAllSelectedObjectsAsArray().filter((mesh) => !ModifierVolumeBevel.isVolume(mesh));
  }

  /**
   * Resolves the one selected face region with its mapping and operation
   * context.
   *
   * @returns Mapping and context, or null when the selection is not one face
   *   region.
   */
  private singleFaceRegionResolve(): {
    mapping: ReturnType<typeof resolveTargetMapping>;
    context: FaceUvOperationContext;
  } | null {
    if (this.faceExtrusionController.getSelectionMode() !== SelectionMode.FACE) {
      return null;
    }
    const targets = this.collectTargets();
    const target = targets[0];
    if (!target || targets.length !== 1) {
      return null;
    }
    const context = createWorldPolygonTargetContextFactory(this.cameraDirectionsProvider())(target);
    if (!context) {
      return null;
    }
    return { mapping: resolveTargetMapping(target), context };
  }

  /**
   * Evaluates the status flags of one mapping against one face context.
   *
   * @param uv UV matrix of the face.
   * @param context Face polygon context.
   * @returns Status flags.
   */
  private statusReadForMapping(uv: SurfaceUvMatrix, context: FaceUvOperationContext): FaceUvToolSelectionStatus {
    return {
      fittedU: FaceUvOperationStatus.isFaceFitted(uv, context, 'u'),
      fittedV: FaceUvOperationStatus.isFaceFitted(uv, context, 'v'),
      justifiedLeft: FaceUvOperationStatus.isFaceJustified(uv, context, 'left'),
      justifiedRight: FaceUvOperationStatus.isFaceJustified(uv, context, 'right'),
      justifiedTop: FaceUvOperationStatus.isFaceJustified(uv, context, 'top'),
      justifiedBottom: FaceUvOperationStatus.isFaceJustified(uv, context, 'bottom'),
      justifiedCenter: FaceUvOperationStatus.isFaceJustified(uv, context, 'center'),
      aligned: FaceUvOperationStatus.isFaceAligned(uv, context),
    };
  }
}

/**
 * Measures the shear factor of one matrix axis pair: how much the sheared row
 * leans along the other row's direction, in the other row's units.
 *
 * @param uv UV matrix.
 * @param mode Which coordinate's shear is measured.
 * @returns Shear factor.
 */
function faceShearFactorRead(uv: SurfaceUvMatrix, mode: FaceUvShearMode): number {
  if (mode === 'u-by-v') {
    const vDirection = faceUvRowDirection(uv.v);
    return (uv.u.x * vDirection.x + uv.u.y * vDirection.y + uv.u.z * vDirection.z) / faceUvRowMagnitude(uv.v);
  }
  const uDirection = faceUvRowDirection(uv.u);
  return (uv.v.x * uDirection.x + uv.v.y * uDirection.y + uv.v.z * uDirection.z) / faceUvRowMagnitude(uv.u);
}
