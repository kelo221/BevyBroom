import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { FaceUvOperation } from '@/texture/uv/operations/face_uv_operation.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { CommandTextureSolidFaceEdit, type SolidFaceTextureTarget } from './command_texture_solid_face_edit.js';

/** Smallest face corner count that describes a polygon. */
const SOLID_FACE_UV_MIN_CORNERS = 3;

/**
 * Undoable face UV operation (fit, justify, rotate, ...) applied to authored
 * solid brush faces in brush-local space, the space their UV matrices use.
 */
export class CommandTextureSolidFaceUvOperation extends CommandTextureSolidFaceEdit {
  private readonly operation: FaceUvOperation;

  /**
   * Creates a face UV operation command.
   *
   * @param targets Brush faces to change.
   * @param operation Pure UV operation applied to each face.
   */
  constructor(targets: readonly SolidFaceTextureTarget[], operation: FaceUvOperation) {
    super(targets);
    this.operation = operation;
  }

  /**
   * Replaces one face's UV matrix with the operation result.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @returns True when the face polygon was usable.
   */
  protected faceEdit(brush: SolidBrushInstance, surfaceIndex: number): boolean {
    const context = solidFaceUvOperationContextBuild(brush, surfaceIndex);
    if (!context) {
      return false;
    }
    const surface = brush.getFaceSurface(surfaceIndex);
    brush.setFaceSurface(surfaceIndex, { ...surface, uv: this.operation.apply(surface.uv, context) });
    return true;
  }
}

/**
 * Builds the UV operation context of one brush face in brush-local space.
 *
 * @param brush Brush owning the face.
 * @param surfaceIndex Face index.
 * @returns Context, or null when the face has fewer than three corners.
 */
export function solidFaceUvOperationContextBuild(
  brush: SolidBrushInstance,
  surfaceIndex: number,
): FaceUvOperationContext | null {
  const face = brush.brush.faces[surfaceIndex];
  const corners = face ? brush.brush.getFaceVertices(face) : [];
  if (corners.length < SOLID_FACE_UV_MIN_CORNERS) {
    return null;
  }
  return new FaceUvOperationContext({ vertices: corners, faceNormal: brush.faceNormalLocal(surfaceIndex) });
}
