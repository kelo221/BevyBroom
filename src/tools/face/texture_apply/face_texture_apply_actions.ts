import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import type { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { CommandTextureFaceApply } from '@/texture/commands/command_texture_face_apply.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  buildTargetsFromFaceSelection,
  resolveTargetMapping,
  type TextureApplyTarget,
} from '@/texture/uv/face_texture_applier.js';
import { createDefaultFaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { FaceUvOperationAlignToView } from '@/texture/uv/operations/face_uv_operation_align_to_view.js';
import {
  createWorldPolygonTargetContextFactory,
  faceUvCameraDirectionsFromCamera,
} from '@/texture/uv/operations/face_uv_operation_context_factory.js';
import type { FacePickResult } from '@/selection/face/raycaster_face_selection.js';
import { type FaceAttributeTransferHandler, pickToSelection } from '@/tools/face/face_attribute_transfer_handler.js';
import type { FaceLiftedSurfaceStore } from './face_lifted_surface_store.js';

/** Services the texture application actions run through. */
export interface FaceTextureApplyActionsDeps {
  /** Undo stack receiving the Align to View batch. */
  readonly commandStack: CommandStack;
  /** Paints textures onto faces as undo steps. */
  readonly textureAssignment: ControllerTextureAssignment;
  /** Copies alignment from one face onto another as undo steps. */
  readonly attributeTransferHandler: FaceAttributeTransferHandler;
  /** Remembers the last lifted face. */
  readonly liftedSurfaceStore: FaceLiftedSurfaceStore;
  /** Refreshes viewport shading after a surface edit. */
  readonly afterSurfaceEdit: () => void;
  /** Shows a status bar message. */
  readonly showStatusMessage: (message: string) => void;
}

/**
 * Hammer++ texture application actions on one clicked face: apply the current
 * texture only, apply it with the lifted alignment, project it from the view,
 * or lift the face's texture and alignment. Every edit is one undo step.
 */
export class FaceTextureApplyActions {
  private readonly deps: FaceTextureApplyActionsDeps;

  /**
   * Creates the actions.
   *
   * @param deps Undo, assignment, transfer and status services.
   */
  constructor(deps: FaceTextureApplyActionsDeps) {
    this.deps = deps;
  }

  /**
   * Paints the current texture onto the clicked face, keeping its alignment.
   *
   * @param pick Clicked face.
   * @returns True when the face was painted.
   */
  textureOnlyApply(pick: FacePickResult): boolean {
    const textureId = currentTextureIdRead();
    return this.deps.textureAssignment.assignTextureToFaces([pickToSelection(pick)], {
      id: textureId,
      displayName: textureId,
    });
  }

  /**
   * Paints the current texture onto the clicked face with the alignment of the
   * lifted face, continued across their shared edge. Without a lifted face the
   * primary selected face is the source.
   *
   * @param pick Clicked face.
   * @returns True when the face was painted.
   */
  textureWithValuesApply(pick: FacePickResult): boolean {
    const source =
      this.deps.liftedSurfaceStore.liftedTargetRead() ?? this.deps.attributeTransferHandler.primaryTargetRead();
    if (!source) {
      this.deps.showStatusMessage('Lift a face first to apply its texture values');
      return false;
    }
    return this.deps.attributeTransferHandler.transferToPick(source, pick, {
      textureIdOverride: currentTextureIdRead(),
      statusMessage: 'Applied current texture and lifted values to the clicked face',
    });
  }

  /**
   * Projects the current texture onto the clicked face from the camera like a
   * slide projector, as one undo step.
   *
   * @param pick Clicked face.
   * @param camera Camera the texture is projected from.
   * @returns True when the face was aligned.
   */
  alignToViewApply(pick: FacePickResult, camera: THREE.Camera): boolean {
    const targets = buildTargetsFromFaceSelection([pickToSelection(pick)]);
    const assignment = this.deps.textureAssignment.faceTextureAssignmentBuild(
      [pickToSelection(pick)],
      currentTextureIdRead(),
    );
    if (targets.length === 0 || !assignment) {
      return false;
    }
    const alignCommand = new CommandTextureFaceApply(targets, createDefaultFaceTextureMapping(), {
      matrixOperation: new FaceUvOperationAlignToView(),
      matrixOperationContextFactory: createWorldPolygonTargetContextFactory(faceUvCameraDirectionsFromCamera(camera)),
    });
    this.deps.commandStack.push(new CommandUndoBatch([alignCommand, assignment.command]));
    this.deps.afterSurfaceEdit();
    this.deps.showStatusMessage('Aligned current texture to the view on the clicked face');
    return true;
  }

  /**
   * Lifts the clicked face: its texture becomes the current texture and its
   * alignment the source of later texture + values applications.
   *
   * @param pick Clicked face.
   * @returns Lifted texture identity, or null when the face has no region.
   */
  lift(pick: FacePickResult): string | null {
    const target = buildTargetsFromFaceSelection([pickToSelection(pick)])[0];
    if (!target) {
      return null;
    }
    return this.liftedTargetRecord(target);
  }

  /**
   * Records a lifted region and makes its texture the current texture.
   *
   * @param target Lifted region.
   * @returns Lifted texture identity.
   */
  private liftedTargetRecord(target: TextureApplyTarget): string {
    this.deps.liftedSurfaceStore.liftedTargetWrite(target);
    const textureId = resolveTargetMapping(target).textureId;
    getStateTexturePaint().setLastTextureId(textureId);
    return textureId;
  }
}

/**
 * Reads the current paint texture.
 *
 * @returns Current texture identity.
 */
function currentTextureIdRead(): string {
  return getStateTexturePaint().getLastTextureId();
}
