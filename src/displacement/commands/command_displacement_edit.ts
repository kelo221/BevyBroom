import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  CommandTextureSolidFaceEdit,
  type SolidFaceTextureTarget,
} from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';

/** Displacement one brush face receives from a displacement edit. */
export interface DisplacementFaceEdit {
  /** Brush face to edit. */
  target: SolidFaceTextureTarget;
  /** Displacement to store, or null to make the face flat again. */
  displacement: DisplacementFaceSurface | null;
}

/**
 * Undoable edit that creates, replaces or removes the displacements of brush
 * faces. Undo restores each face's previous surface including its previous
 * displacement, and both directions remesh only the touched brushes.
 */
export class CommandDisplacementEdit extends CommandTextureSolidFaceEdit {
  private readonly edits: readonly DisplacementFaceEdit[];

  /**
   * Creates a displacement edit.
   *
   * @param edits Faces with the displacement each one receives (copied).
   */
  constructor(edits: readonly DisplacementFaceEdit[]) {
    super(edits.map((edit) => edit.target));
    this.edits = edits.map((edit) => ({
      target: edit.target,
      displacement: edit.displacement ? displacementSurfaceClone(edit.displacement) : null,
    }));
  }

  /**
   * Stores the displacement planned for one face.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @returns True when an edit targets the face.
   */
  protected faceEdit(brush: SolidBrushInstance, surfaceIndex: number): boolean {
    const edit = this.edits.find(
      (entry) =>
        entry.target.surfaceIndex === surfaceIndex && entry.target.model.findBrush(entry.target.brushId) === brush,
    );
    if (!edit) {
      return false;
    }
    brush.faceDisplacementWrite(surfaceIndex, edit.displacement);
    return true;
  }
}
