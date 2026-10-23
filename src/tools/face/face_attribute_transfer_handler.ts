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

/**
 * Runs the Alt+click face attribute transfer: copies the primary selected
 * face's material and alignment onto the clicked face as one undo step.
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
    const primary = this.deps.faceExtrusionController.getSelectedFaces()[0];
    if (!primary) {
      return false;
    }
    const pick = this.deps.faceExtrusionController.pickFaceAtPointer(event, camera, pickElement);
    if (!pick) {
      return false;
    }
    return this.run(primary, pick);
  }

  /**
   * Runs the transfer from the primary selected face onto a picked face.
   *
   * @param primary Primary selected face.
   * @param pick Picked destination face.
   * @returns True when the transfer ran or the click was consumed.
   */
  private run(primary: FaceSelection, pick: FacePickResult): boolean {
    const sourceTarget = buildTargetsFromFaceSelection([primary])[0];
    const destination = buildTargetsFromFaceSelection([pickToSelection(pick)])[0];
    if (!sourceTarget || !destination) {
      return false;
    }
    if (regionsEqual(sourceTarget, destination)) {
      return true;
    }
    this.deps.commandStack.push(new CommandTextureFaceAttributeTransfer(sourceTarget, [destination]));
    this.deps.updateShadingMeshes();
    this.deps.showStatusMessage('Copied material and alignment to the clicked face');
    return true;
  }
}

/**
 * Converts a face pick into a face selection entry.
 *
 * @param pick Picked face.
 * @returns Selection entry for target building.
 */
function pickToSelection(pick: FacePickResult): FaceSelection {
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
