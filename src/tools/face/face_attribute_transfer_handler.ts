import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { buildTargetsFromFaceSelection, type TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { CommandTextureFaceAttributeTransfer } from '@/texture/commands/command_texture_face_attribute_transfer.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import type { FacePickResult } from '@/selection/face/raycaster_face_selection.js';

/** Dependencies the Alt+click attribute transfer needs. */
export interface FaceAttributeTransferHandlerDeps {
  commandStack: CommandStack;
  faceExtrusionController: {
    getSelectedFaces(): FaceSelection[];
    pickFaceAtPointer(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): FacePickResult | null;
  };
  isAltDown: () => boolean;
  updateShadingMeshes: () => void;
  showStatusMessage: (message: string) => void;
}

/** Material and status text of one transfer onto a clicked face. */
export interface FaceAttributeTransferRequest {
  /** Material written instead of the source material, or null to copy it. */
  readonly textureIdOverride: string | null;
  /** Status bar text shown after the transfer ran. */
  readonly statusMessage: string;
}

/**
 * Runs face attribute transfers onto a clicked face as one undo step: the
 * Alt+click transfer from the primary selected face, and transfers from any
 * other source region with an optional replacement material.
 */
export class FaceAttributeTransferHandler {
  private deps: FaceAttributeTransferHandlerDeps;

  /**
   * Creates the transfer handler.
   *
   * @param deps Owner controller services.
   */
  constructor(deps: FaceAttributeTransferHandlerDeps) {
    this.deps = deps;
  }

  /**
   * Starts a transfer when Alt is held and a primary face is selected.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Pick element.
   * @returns True when a transfer ran or the click was deliberately consumed.
   */
  tryBegin(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (!this.deps.isAltDown()) {
      return false;
    }
    const primary = this.primaryTargetRead();
    if (!primary) {
      return false;
    }
    const pick = this.deps.faceExtrusionController.pickFaceAtPointer(event, camera, pickElement);
    if (!pick) {
      return false;
    }
    return this.transferToPick(primary, pick, {
      textureIdOverride: null,
      statusMessage: 'Copied material and alignment to the clicked face',
    });
  }

  /**
   * Returns the region of the primary selected face.
   *
   * @returns Primary region, or null without a face selection.
   */
  primaryTargetRead(): TextureApplyTarget | null {
    const primary = this.deps.faceExtrusionController.getSelectedFaces()[0];
    if (!primary) {
      return null;
    }
    return buildTargetsFromFaceSelection([primary])[0] ?? null;
  }

  /**
   * Transfers a source region's alignment, and its material or a replacement,
   * onto a picked face as one undo step.
   *
   * @param source Region whose alignment is copied.
   * @param pick Picked destination face.
   * @param request Replacement material and status text.
   * @returns True when the transfer ran or the click was consumed.
   */
  transferToPick(source: TextureApplyTarget, pick: FacePickResult, request: FaceAttributeTransferRequest): boolean {
    const destination = buildTargetsFromFaceSelection([pickToSelection(pick)])[0];
    if (!destination) {
      return false;
    }
    if (regionsEqual(source, destination) && request.textureIdOverride === null) {
      return true;
    }
    this.deps.commandStack.push(
      new CommandTextureFaceAttributeTransfer(source, [destination], request.textureIdOverride),
    );
    this.deps.updateShadingMeshes();
    this.deps.showStatusMessage(request.statusMessage);
    return true;
  }
}

/**
 * Converts a face pick into a face selection entry.
 *
 * @param pick Picked face.
 * @returns Selection entry for target building.
 */
export function pickToSelection(pick: FacePickResult): FaceSelection {
  return { mesh: pick.mesh, faceIndex: pick.faceIndex };
}

/**
 * Compares two apply target regions for identity.
 *
 * @param a First region.
 * @param b Second region.
 * @returns True when both cover the same triangles of the same mesh.
 */
function regionsEqual(a: TextureApplyTarget, b: TextureApplyTarget): boolean {
  if (a.mesh !== b.mesh) {
    return false;
  }
  return regionKey(a.triangleIndices) === regionKey(b.triangleIndices);
}

/**
 * Builds a stable identity key for a triangle region.
 *
 * @param indices Region triangles in any order.
 * @returns Sorted triangle index key.
 */
function regionKey(indices: number[]): string {
  return indices
    .slice()
    .sort((x, y) => x - y)
    .join(',');
}
