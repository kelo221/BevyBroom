import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { CommandTextureSolidFaceEdit, type SolidFaceTextureTarget } from './command_texture_solid_face_edit.js';

/**
 * Undoable per-face solid texture assignment on brush surfaces.
 * Presentation-only: remeshes painted brushes, never force-rebuilds CSG.
 */
export class CommandTextureSolidFaceAssign extends CommandTextureSolidFaceEdit {
  private readonly textureId: string;

  /**
   * Creates a solid face texture command.
   *
   * @param targets Unique brush faces to paint.
   * @param textureId Texture identity.
   */
  constructor(targets: readonly SolidFaceTextureTarget[], textureId: string) {
    super(targets);
    this.textureId = textureId;
  }

  /**
   * Paints one face with the texture while keeping its UV matrix.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @returns Always true.
   */
  protected faceEdit(brush: SolidBrushInstance, surfaceIndex: number): boolean {
    brush.setFaceTextureId(surfaceIndex, this.textureId);
    return true;
  }
}
