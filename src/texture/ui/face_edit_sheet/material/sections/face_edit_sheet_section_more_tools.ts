import { Theme } from '@/theme.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { FaceAttributesUvToolStrip } from '@/texture/ui/face_attributes/face_attributes_uv_tool_strip.js';
import {
  FACE_ATTRIBUTES_UV_TOOL_SPECS,
  type FaceAttributesUvToolButtonSpec,
} from '@/texture/ui/face_attributes/face_attributes_uv_tool_specs.js';
import {
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_SCALE,
  type FaceAttributesRowSpec,
} from '@/texture/ui/face_attributes/face_attributes_field_specs.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { FaceEditSheetSection, type FaceEditSheetSelectionState } from './face_edit_sheet_section.js';
import { faceEditSheetFullTileShiftRowCreate } from './face_edit_sheet_full_tile_shift_row.js';

/** UV tool rows of the More tools section, beyond what the Hammer layout shows. */
export const FACE_EDIT_SHEET_MORE_TOOLS_UV_ROWS: ReadonlyArray<readonly FaceAttributesUvToolButtonSpec[]> = [
  [FACE_ATTRIBUTES_UV_TOOL_SPECS.fitU, FACE_ATTRIBUTES_UV_TOOL_SPECS.fitV],
  [
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignPrevious,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignBest,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignNext,
  ],
  [
    FACE_ATTRIBUTES_UV_TOOL_SPECS.flipHorizontal,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.flipVertical,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.rotateCounterClockwise,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.rotateClockwise,
  ],
  [
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignFloor,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignWall,
    FACE_ATTRIBUTES_UV_TOOL_SPECS.alignCeiling,
  ],
  [FACE_ATTRIBUTES_UV_TOOL_SPECS.resetUvs, FACE_ATTRIBUTES_UV_TOOL_SPECS.resetWorld],
];

/** Field rows whose nudge buttons the More tools section offers. */
const FACE_EDIT_SHEET_MORE_TOOLS_NUDGE_ROWS: readonly FaceAttributesRowSpec[] = [
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_SCALE,
];

/** Axis caption of the X then Y field of a nudge row. */
const FACE_EDIT_SHEET_MORE_TOOLS_AXIS_CAPTIONS: readonly string[] = ['X', 'Y'];

/**
 * Collapsible More tools section of the Material tab holding the BevyBroom UV
 * tools the Hammer layout lacks: whole-tile shifts, Fit H/V, Align, Flip,
 * Rotate, Align Floor / Wall / Ceiling, Reset UVs / World, shear and the offset
 * / scale nudges. Collapsed by default; the expanded state lives in the Face
 * Edit Sheet session.
 */
export class FaceEditSheetSectionMoreTools extends FaceEditSheetSection {
  private readonly toggleButton: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly uvToolStrip: FaceAttributesUvToolStrip;

  /**
   * Creates the header toggle and the collapsed tool body.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-more-tools');
    this.uvToolStrip = new FaceAttributesUvToolStrip(this.handlers, FACE_EDIT_SHEET_MORE_TOOLS_UV_ROWS);
    this.toggleButton = this.toggleButtonCreate();
    this.body = this.bodyCreate();
    this.element.style.borderTop = `1px solid ${Theme.inputBorderColor}`;
    this.element.style.paddingTop = `${FACE_INSPECTOR_METRICS.gap}px`;
    this.element.append(this.toggleButton, this.body);
  }

  /**
   * Returns whether the tool body is shown.
   *
   * @returns True while expanded.
   */
  isExpanded(): boolean {
    return this.body.style.display !== 'none';
  }

  /** Shows or hides the tool body from the session's expanded state. */
  override sessionSync(): void {
    const isExpanded = getStateFaceEditSession().moreToolsExpandedRead();
    this.body.style.display = isExpanded ? 'flex' : 'none';
    this.toggleButton.textContent = `${isExpanded ? '▾' : '▸'} More tools`;
    this.toggleButton.setAttribute('aria-expanded', String(isExpanded));
  }

  /**
   * Highlights satisfied tools and shows the shared shear values.
   *
   * @param selection Face selection values.
   */
  override selectionWrite(selection: FaceEditSheetSelectionState): void {
    this.uvToolStrip.setFromStatus(selection.uvToolStatus);
    this.uvToolStrip.setShearValues(selection.shearU, selection.shearV);
  }

  /** Releases the shear field listeners. */
  override dispose(): void {
    this.uvToolStrip.dispose();
  }

  /**
   * Creates the header button that expands or collapses the section.
   *
   * @returns Toggle button.
   */
  private toggleButtonCreate(): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: 'More tools',
      widthPx: null,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick: () => this.expandedToggle(),
    });
    button.classList.add('face-edit-sheet-more-tools-toggle');
    button.style.width = '100%';
    button.style.justifyContent = 'flex-start';
    return button;
  }

  /** Flips the session's expanded state of the section. */
  private expandedToggle(): void {
    const session = getStateFaceEditSession();
    session.moreToolsExpandedWrite(!session.moreToolsExpandedRead());
  }

  /**
   * Creates the hidden tool body: whole-tile shifts, UV tools and nudges.
   *
   * @returns Body element.
   */
  private bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.classList.add('face-edit-sheet-more-tools-body');
    body.style.display = 'none';
    body.style.flexDirection = 'column';
    body.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    body.style.paddingTop = `${FACE_INSPECTOR_METRICS.gap}px`;
    this.uvToolStrip.getElement().style.padding = '0';
    body.append(
      faceEditSheetFullTileShiftRowCreate((tilesU, tilesV) => this.handlers.onShiftFullTile?.(tilesU, tilesV)),
      this.uvToolStrip.getElement(),
      ...FACE_EDIT_SHEET_MORE_TOOLS_NUDGE_ROWS.map((row) => this.nudgeRowCreate(row)),
    );
    return body;
  }

  /**
   * Creates one captioned row of the nudge buttons of a field row.
   *
   * @param row Field row whose nudges are offered.
   * @returns Row element.
   */
  private nudgeRowCreate(row: FaceAttributesRowSpec): HTMLElement {
    const element = document.createElement('div');
    element.style.display = 'flex';
    element.style.flexWrap = 'wrap';
    element.style.alignItems = 'center';
    element.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    const caption = faceInspectorCaptionCreate(row.label);
    caption.style.width = '40px';
    element.appendChild(caption);
    row.fields.forEach((spec, index) => {
      const axisCaption = FACE_EDIT_SHEET_MORE_TOOLS_AXIS_CAPTIONS[index] ?? '';
      spec.nudges.forEach((nudge) =>
        element.appendChild(
          this.nudgeButtonCreate(nudge.title, `${axisCaption} ${nudge.text}`, () =>
            this.handlers.onRelativeOp(nudge.op),
          ),
        ),
      );
    });
    return element;
  }

  /**
   * Creates one nudge button.
   *
   * @param title Accessible name and tooltip.
   * @param text Visible label.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private nudgeButtonCreate(title: string, text: string, onClick: () => void): HTMLButtonElement {
    return buttonCompactCreate({ title, text, widthPx: null, heightPx: FACE_INSPECTOR_METRICS.controlHeight, onClick });
  }
}
