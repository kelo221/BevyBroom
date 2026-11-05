import { InputNumberSpinner } from '@/ui/input/input_number_spinner.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import {
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_ROTATION,
  FACE_ATTRIBUTES_ROW_SCALE,
  type FaceAttributesFieldSpec,
  type FaceAttributesRowSpec,
} from '@/texture/ui/face_attributes/face_attributes_field_specs.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { FaceEditSheetSection, type FaceEditSheetSelectionState } from './face_edit_sheet_section.js';

/** Axis caption of the X then Y field of a row. */
const FACE_EDIT_SHEET_TRANSFORM_AXIS_CAPTIONS: readonly string[] = ['X', 'Y'];

/** Whole-tile shift (tiles U, tiles V) of the X then Y shift button. */
const FACE_EDIT_SHEET_TRANSFORM_FULL_TILE_SHIFTS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
];

/**
 * Width of the X / Y full-tile shift buttons in pixels; square with the spinner
 * height.
 */
const FACE_EDIT_SHEET_TRANSFORM_SHIFT_BUTTON_WIDTH_PX = FACE_INSPECTOR_METRICS.controlHeight;

/** Width of every scale, shift and rotation spinner in pixels. */
export const FACE_EDIT_SHEET_TRANSFORM_SPINNER_WIDTH_PX = 80;

/** Width of the `X:` / `Y:` axis captions in pixels. */
const FACE_EDIT_SHEET_TRANSFORM_AXIS_CAPTION_WIDTH_PX = 14;

/** One spinner with the field spec it edits. */
interface FaceEditSheetTransformFieldEntry {
  readonly spec: FaceAttributesFieldSpec;
  readonly spinner: InputNumberSpinner;
}

/**
 * Hammer-style first row of the Material tab: Texture scale X/Y, Texture shift
 * X/Y with a whole-tile X / Y button beside each, and Rotation, all as spinners
 * that commit only the edited value.
 */
export class FaceEditSheetSectionTransform extends FaceEditSheetSection {
  private readonly fieldEntries: FaceEditSheetTransformFieldEntry[];

  /**
   * Creates the scale, shift and rotation columns.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-transform');
    this.fieldEntries = [];
    this.layoutStyleApply();
    this.element.append(
      this.columnCreate('Texture scale:', FACE_ATTRIBUTES_ROW_SCALE, false),
      this.columnCreate('Texture shift:', FACE_ATTRIBUTES_ROW_OFFSET, true),
      this.columnCreate('Rotation:', FACE_ATTRIBUTES_ROW_ROTATION, false),
    );
  }

  /**
   * Shows the shared or mixed scale, shift and rotation values.
   *
   * @param selection Face selection values.
   */
  override selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.fieldEntries.forEach((entry) => {
      entry.spinner.setNumber(selection.fields[entry.spec.key], entry.spec.decimals);
    });
  }

  /** Releases the spinner listeners. */
  override dispose(): void {
    this.fieldEntries.forEach((entry) => entry.spinner.dispose());
  }

  /** Lays the three columns out side by side at their own widths. */
  private layoutStyleApply(): void {
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'flex-start';
    this.element.style.justifyContent = 'space-between';
    this.element.style.columnGap = `${FACE_INSPECTOR_METRICS.gap + 8}px`;
  }

  /**
   * Creates one captioned column with a spinner row per field.
   *
   * @param caption Column caption.
   * @param row Field specs of the column.
   * @param withShiftButtons True to add a whole-tile shift button per field.
   * @returns Column element.
   */
  private columnCreate(caption: string, row: FaceAttributesRowSpec, withShiftButtons: boolean): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    column.style.flex = '0 0 auto';
    column.appendChild(faceInspectorCaptionCreate(caption));
    const showsAxisCaptions = row.fields.length > 1;
    row.fields.forEach((spec, index) => {
      column.appendChild(this.axisRowCreate(spec, showsAxisCaptions ? index : null, withShiftButtons));
    });
    return column;
  }

  /**
   * Creates one row: optional axis caption, the spinner and an optional
   * whole-tile shift button.
   *
   * @param spec Field spec of the spinner.
   * @param axisIndex 0 for X, 1 for Y, or null without an axis caption.
   * @param withShiftButton True to add the whole-tile shift button.
   * @returns Row element.
   */
  private axisRowCreate(
    spec: FaceAttributesFieldSpec,
    axisIndex: number | null,
    withShiftButton: boolean,
  ): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    row.style.height = `${FACE_INSPECTOR_METRICS.controlHeight}px`;
    if (axisIndex !== null) {
      row.appendChild(this.axisCaptionCreate(axisIndex));
    }
    row.appendChild(this.spinnerCreate(spec).spinnerElementRead());
    if (withShiftButton && axisIndex !== null) {
      row.appendChild(this.shiftButtonCreate(axisIndex));
    }
    return row;
  }

  /**
   * Creates the fixed-width `X:` or `Y:` caption in front of a spinner.
   *
   * @param axisIndex 0 for X, 1 for Y.
   * @returns Caption element.
   */
  private axisCaptionCreate(axisIndex: number): HTMLElement {
    const caption = faceInspectorCaptionCreate(`${FACE_EDIT_SHEET_TRANSFORM_AXIS_CAPTIONS[axisIndex] ?? ''}:`);
    caption.style.width = `${FACE_EDIT_SHEET_TRANSFORM_AXIS_CAPTION_WIDTH_PX}px`;
    caption.style.flex = '0 0 auto';
    return caption;
  }

  /**
   * Creates the fixed-width spinner of one field that commits only that field.
   *
   * @param spec Field spec.
   * @returns Spinner.
   */
  private spinnerCreate(spec: FaceAttributesFieldSpec): InputNumberSpinner {
    const spinner = new InputNumberSpinner({
      step: spec.step,
      decimals: spec.decimals,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      width: `${FACE_EDIT_SHEET_TRANSFORM_SPINNER_WIDTH_PX}px`,
      padding: '0 4px',
      textAlign: 'left',
      ariaLabel: spec.ariaLabel,
    });
    spinner.spinnerElementRead().style.flex = '0 0 auto';
    spinner.bindCommit(() => this.fieldCommit(spec, spinner));
    this.fieldEntries.push({ spec, spinner });
    return spinner;
  }

  /**
   * Applies the value of one spinner when it parses to a number.
   *
   * @param spec Field spec of the spinner.
   * @param spinner Spinner holding the value.
   */
  private fieldCommit(spec: FaceAttributesFieldSpec, spinner: InputNumberSpinner): void {
    const value = spinner.parseNumberOrNull();
    if (value === null) {
      return;
    }
    this.handlers.onApplyPartialTrs({ [spec.key]: value });
  }

  /**
   * Creates the X or Y button that shifts by one whole tile on that axis.
   *
   * @param axisIndex 0 for X, 1 for Y.
   * @returns Button element.
   */
  private shiftButtonCreate(axisIndex: number): HTMLButtonElement {
    const axisCaption = FACE_EDIT_SHEET_TRANSFORM_AXIS_CAPTIONS[axisIndex] ?? '';
    const [tilesU, tilesV] = FACE_EDIT_SHEET_TRANSFORM_FULL_TILE_SHIFTS[axisIndex] ?? [0, 0];
    const button = buttonCompactCreate({
      title: `Shift ${axisCaption} by one whole tile`,
      text: axisCaption,
      widthPx: FACE_EDIT_SHEET_TRANSFORM_SHIFT_BUTTON_WIDTH_PX,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick: () => this.handlers.onShiftFullTile?.(tilesU, tilesV),
    });
    button.classList.add('face-edit-sheet-shift-full-tile');
    return button;
  }
}
