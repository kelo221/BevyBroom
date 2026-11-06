import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import type { SurfaceUvVectors2x3 } from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';

/** Face selection values the Material tab sections show. */
export interface FaceEditSheetSelectionState {
  /** Shared or mixed offset, scale, rotation, align and texture values. */
  readonly fields: UvEditorTrsFieldState;
  /** 2×3 UV vectors of the first selected face, or null. */
  readonly vectors: SurfaceUvVectors2x3 | null;
  /** Fit, justify and align status of the single selected face, or null. */
  readonly uvToolStatus: FaceUvToolSelectionStatus | null;
  /** Shared U shear factor, or null when mixed. */
  readonly shearU: number | null;
  /** Shared V shear factor, or null when mixed. */
  readonly shearV: number | null;
}

/**
 * Base of one block of the Face Edit Sheet Material tab. A section owns its
 * element and overrides the refresh hooks it needs; every hook does nothing by
 * default.
 */
export abstract class FaceEditSheetSection {
  protected readonly handlers: DialogFaceEditSheetHandlers;
  protected readonly element: HTMLElement;

  /**
   * Creates the section element.
   *
   * @param handlers Face Edit Sheet action callbacks.
   * @param className Class name of the section element.
   */
  protected constructor(handlers: DialogFaceEditSheetHandlers, className: string) {
    this.handlers = handlers;
    this.element = document.createElement('div');
    this.element.classList.add('face-edit-sheet-section', className);
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  elementRead(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the face selection values.
   *
   * @param selection Face selection values.
   */
  selectionWrite(selection: FaceEditSheetSelectionState): void {
    void selection;
  }

  /** Shows the Face Edit Sheet session state (pick mode, toggles, sections). */
  sessionSync(): void {}

  /** Shows the current texture. */
  textureSync(): void {}

  /** Releases listeners of the section. */
  dispose(): void {}
}
