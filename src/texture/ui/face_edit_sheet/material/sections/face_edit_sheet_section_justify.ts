import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';
import {
  FACE_ATTRIBUTES_UV_TOOL_SPECS,
  faceAttributesUvToolButtonHighlightApply,
  type FaceAttributesUvToolButtonSpec,
} from '@/texture/ui/face_attributes/face_attributes_uv_tool_specs.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { faceEditSheetGroupBoxCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_group_box.js';
import { FaceEditSheetSection, type FaceEditSheetSelectionState } from './face_edit_sheet_section.js';

/** One button of the Justify cross with its grid cell. */
export interface FaceEditSheetJustifyCrossCell {
  /** Short button label. */
  readonly label: string;
  /** UV tool the button runs and highlights from. */
  readonly spec: FaceAttributesUvToolButtonSpec;
  /** Grid row, 1-based. */
  readonly row: number;
  /** Grid column, 1-based. */
  readonly column: number;
}

/** Hammer Justify cross: Fit and T on top, L C R in the middle, B below. */
export const FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS: readonly FaceEditSheetJustifyCrossCell[] = [
  { label: 'Fit', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.fitBoth, row: 1, column: 1 },
  { label: 'T', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyTop, row: 1, column: 2 },
  { label: 'L', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyLeft, row: 2, column: 1 },
  { label: 'C', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyCenter, row: 2, column: 2 },
  { label: 'R', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyRight, row: 2, column: 3 },
  { label: 'B', spec: FACE_ATTRIBUTES_UV_TOOL_SPECS.justifyBottom, row: 3, column: 2 },
];

/** Width of one Justify cross button in pixels. */
const FACE_EDIT_SHEET_JUSTIFY_BUTTON_WIDTH_PX = 26;

/** One created cross button with its cell. */
interface FaceEditSheetJustifyCrossButton {
  readonly cell: FaceEditSheetJustifyCrossCell;
  readonly button: HTMLButtonElement;
}

/**
 * Hammer Justify group box: a cross of Fit / T / L C R / B buttons that fit or
 * justify the selected faces and highlight the side the face already meets.
 */
export class FaceEditSheetSectionJustify extends FaceEditSheetSection {
  private readonly crossButtons: FaceEditSheetJustifyCrossButton[];

  /**
   * Creates the Justify group box.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-justify');
    this.crossButtons = FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS.map((cell) => ({ cell, button: this.buttonCreate(cell) }));
    this.element.appendChild(faceEditSheetGroupBoxCreate('Justify', 'face-edit-sheet-justify-box', this.gridCreate()));
  }

  /**
   * Highlights the cross buttons the single selected face already satisfies.
   *
   * @param selection Face selection values.
   */
  override selectionWrite(selection: FaceEditSheetSelectionState): void {
    const status = selection.uvToolStatus;
    this.crossButtons.forEach(({ cell, button }) => {
      const isHighlighted = cell.spec.isHighlighted;
      faceAttributesUvToolButtonHighlightApply(
        button,
        status !== null && isHighlighted !== undefined && isHighlighted(status),
      );
    });
  }

  /**
   * Creates the 3×3 grid holding the cross buttons.
   *
   * @returns Grid element.
   */
  private gridCreate(): HTMLElement {
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(3, ${FACE_EDIT_SHEET_JUSTIFY_BUTTON_WIDTH_PX}px)`;
    grid.style.gridTemplateRows = `repeat(3, ${FACE_INSPECTOR_METRICS.controlHeight}px)`;
    grid.style.gap = '2px';
    grid.style.justifyContent = 'center';
    this.crossButtons.forEach(({ button }) => grid.appendChild(button));
    return grid;
  }

  /**
   * Creates one cross button placed in its grid cell.
   *
   * @param cell Cross cell.
   * @returns Button element.
   */
  private buttonCreate(cell: FaceEditSheetJustifyCrossCell): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: cell.spec.title,
      text: cell.label,
      widthPx: FACE_EDIT_SHEET_JUSTIFY_BUTTON_WIDTH_PX,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick: () => cell.spec.run(this.handlers),
    });
    button.style.gridRow = String(cell.row);
    button.style.gridColumn = String(cell.column);
    return button;
  }
}
