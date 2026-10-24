import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { CommandTextureSolidFaceEdit, type SolidFaceTextureTarget } from './command_texture_solid_face_edit.js';

/** Undoable replacement of the UV matrix of authored solid brush faces. */
export class CommandTextureSolidFaceUvSet extends CommandTextureSolidFaceEdit {
  private readonly uv: SurfaceUvMatrix;

  /**
   * Creates a face UV matrix command.
   *
   * @param targets Brush faces to change.
   * @param uv Brush-local UV matrix every face receives.
   */
  constructor(targets: readonly SolidFaceTextureTarget[], uv: SurfaceUvMatrix) {
    super(targets);
    this.uv = uv.clone();
  }

  /**
   * Stores the UV matrix on one face while keeping its texture.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @returns Always true.
   */
  protected faceEdit(brush: SolidBrushInstance, surfaceIndex: number): boolean {
    const surface = brush.getFaceSurface(surfaceIndex);
    brush.setFaceSurface(surfaceIndex, { ...surface, uv: this.uv.clone() });
    return true;
  }
}
