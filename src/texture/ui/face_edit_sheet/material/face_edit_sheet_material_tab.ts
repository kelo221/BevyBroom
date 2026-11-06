import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import type { FaceEditSheetSection, FaceEditSheetSelectionState } from './sections/face_edit_sheet_section.js';
import { FaceEditSheetSectionTransform } from './sections/face_edit_sheet_section_transform.js';
import { FaceEditSheetSectionVectors } from './sections/face_edit_sheet_section_vectors.js';
import { FaceEditSheetSectionJustify } from './sections/face_edit_sheet_section_justify.js';
import { FaceEditSheetSectionAlign } from './sections/face_edit_sheet_section_align.js';
import { FaceEditSheetSectionSessionOptions } from './sections/face_edit_sheet_section_session_options.js';
import { FaceEditSheetSectionTexture } from './sections/face_edit_sheet_section_texture.js';
import { FaceEditSheetSectionMoreTools } from './sections/face_edit_sheet_section_more_tools.js';

/**
 * Hammer++ style Material tab of the Face Edit Sheet: scale / shift / rotation
 * spinners, UV vectors, the Justify and Align boxes beside the click options,
 * the current texture block, and the collapsible More tools section.
 */
export class FaceEditSheetMaterialTab {
  private readonly element: HTMLElement;
  private readonly sections: readonly FaceEditSheetSection[];

  /**
   * Creates every section and lays them out.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    const transform = new FaceEditSheetSectionTransform(handlers);
    const vectors = new FaceEditSheetSectionVectors(handlers);
    const justify = new FaceEditSheetSectionJustify(handlers);
    const align = new FaceEditSheetSectionAlign(handlers);
    const sessionOptions = new FaceEditSheetSectionSessionOptions(handlers);
    const texture = new FaceEditSheetSectionTexture(handlers);
    const moreTools = new FaceEditSheetSectionMoreTools(handlers);
    this.sections = [transform, vectors, justify, align, sessionOptions, texture, moreTools];
    this.element = this.bodyCreate();
    this.element.append(
      transform.elementRead(),
      vectors.elementRead(),
      this.rowCreate(justify, align, sessionOptions),
      texture.elementRead(),
      moreTools.elementRead(),
    );
  }

  /**
   * Returns the tab body element.
   *
   * @returns Tab body.
   */
  elementRead(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the face selection values in every section.
   *
   * @param selection Face selection values.
   */
  selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.sections.forEach((section) => section.selectionWrite(selection));
  }

  /** Shows the Face Edit Sheet session state in every section. */
  sessionSync(): void {
    this.sections.forEach((section) => section.sessionSync());
  }

  /** Shows the current texture in every section. */
  textureSync(): void {
    this.sections.forEach((section) => section.textureSync());
  }

  /** Releases the listeners of every section. */
  dispose(): void {
    this.sections.forEach((section) => section.dispose());
  }

  /**
   * Creates the padded column body of the tab.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.classList.add('face-edit-sheet-material-tab');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = `${FACE_INSPECTOR_METRICS.gap + 4}px`;
    body.style.padding = `${FACE_INSPECTOR_METRICS.paddingY + 2}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    return body;
  }

  /**
   * Lays sections side by side in one top-aligned row. Every section keeps its
   * own width except the last one, which fills the rest.
   *
   * @param sections Sections of the row, left to right.
   * @returns Row element.
   */
  private rowCreate(...sections: FaceEditSheetSection[]): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('face-edit-sheet-material-options-row');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap + 4}px`;
    sections.forEach((section, index) => {
      const isLast = index === sections.length - 1;
      section.elementRead().style.flex = isLast ? '1 1 0' : '0 0 auto';
      section.elementRead().style.minWidth = isLast ? '0' : 'max-content';
      row.appendChild(section.elementRead());
    });
    return row;
  }
}
