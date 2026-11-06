import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import type { FaceTextureAlign } from '@/texture/uv/face_texture_mapping.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { faceEditSheetGroupBoxCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_group_box.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import { FaceEditSheetSection, type FaceEditSheetSelectionState } from './face_edit_sheet_section.js';

/** Hammer texture alignment: projected from world axes or from the face plane. */
export type FaceEditSheetAlignMode = 'world' | 'face';

/** Align preset applied when the World or Face box is clicked. */
const FACE_EDIT_SHEET_ALIGN_PRESETS: Readonly<Record<FaceEditSheetAlignMode, FaceTextureAlign>> = {
  world: 'auto',
  face: 'face',
};

/**
 * Reads the Hammer alignment shown for a selection's shared align preset.
 *
 * @param align Shared align preset, or null when mixed or empty.
 * @returns World for world-axis presets, face for the face preset, or null.
 */
export function faceEditSheetAlignModeRead(align: FaceTextureAlign | null): FaceEditSheetAlignMode | null {
  if (align === null) {
    return null;
  }
  return align === 'face' ? 'face' : 'world';
}

/**
 * Hammer Align group box: World and Face boxes that act like radio buttons,
 * showing the selection's alignment and re-aligning the selected faces.
 */
export class FaceEditSheetSectionAlign extends FaceEditSheetSection {
  private readonly worldCheckbox: InputCheckbox;
  private readonly faceCheckbox: InputCheckbox;
  private shownMode: FaceEditSheetAlignMode | null;

  /**
   * Creates the Align group box.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-align');
    this.shownMode = null;
    this.worldCheckbox = this.checkboxCreate('world', 'World texture alignment');
    this.faceCheckbox = this.checkboxCreate('face', 'Face texture alignment');
    this.element.appendChild(faceEditSheetGroupBoxCreate('Align', 'face-edit-sheet-align-box', this.columnCreate()));
  }

  /**
   * Checks the box matching the selection's shared alignment.
   *
   * @param selection Face selection values.
   */
  override selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.shownMode = faceEditSheetAlignModeRead(selection.fields.align);
    this.checkboxesShow();
  }

  /**
   * Creates the column of the World and Face boxes.
   *
   * @returns Column element.
   */
  private columnCreate(): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    column.append(
      faceEditSheetCheckboxLabelCreate(this.worldCheckbox, 'World'),
      faceEditSheetCheckboxLabelCreate(this.faceCheckbox, 'Face'),
    );
    return column;
  }

  /**
   * Creates one box that applies its alignment when clicked.
   *
   * @param mode Alignment the box stands for.
   * @param ariaLabel Accessible name.
   * @returns Checkbox.
   */
  private checkboxCreate(mode: FaceEditSheetAlignMode, ariaLabel: string): InputCheckbox {
    const checkbox = new InputCheckbox(ariaLabel);
    checkbox.getElement().dataset['faceEditSheetAlign'] = mode;
    checkbox.bindCommit(() => this.alignApply(mode));
    return checkbox;
  }

  /**
   * Aligns the selected faces and shows the resulting alignment.
   *
   * @param mode Alignment to apply.
   */
  private alignApply(mode: FaceEditSheetAlignMode): void {
    this.handlers.onAlign(FACE_EDIT_SHEET_ALIGN_PRESETS[mode]);
    this.checkboxesShow();
  }

  /** Checks only the box of the shown alignment. */
  private checkboxesShow(): void {
    this.worldCheckbox.setSharedValues([this.shownMode === 'world']);
    this.faceCheckbox.setSharedValues([this.shownMode === 'face']);
  }
}
