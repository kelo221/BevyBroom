import { faceInspectorCaptionCreate } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { FaceEditSheetVectorsRow } from '@/texture/ui/face_edit_sheet/face_edit_sheet_vectors_row.js';
import { FaceEditSheetSection, type FaceEditSheetSelectionState } from './face_edit_sheet_section.js';

/** Material tab block with the captioned 2×3 `UV vectors (X Y Z)` grid. */
export class FaceEditSheetSectionVectors extends FaceEditSheetSection {
  private readonly vectorsRow: FaceEditSheetVectorsRow;

  /**
   * Creates the caption and the U / V vector rows.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-vectors');
    this.vectorsRow = new FaceEditSheetVectorsRow(document, {
      onVectorsCommit: (vectors) => this.handlers.onSetVectors2x3?.(vectors),
    });
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
    this.element.append(faceInspectorCaptionCreate('UV vectors (X Y Z):'), this.vectorsRow.elementRead());
  }

  /**
   * Shows the UV vectors of the first selected face.
   *
   * @param selection Face selection values.
   */
  override selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.vectorsRow.vectorsWrite(selection.vectors);
  }
}
