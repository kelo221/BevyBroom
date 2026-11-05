import { InputNumeric } from '@/ui/input/input_numeric.js';
import type { FaceUvFitAxis } from '@/texture/uv/operations/face_uv_operation_fit.js';
import type { FaceUvJustifySide } from '@/texture/uv/operations/face_uv_operation_justify.js';
import type { FaceUvAlignEdgeMode } from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import type { FaceUvFlipAxis } from '@/texture/uv/operations/face_uv_operation_flip.js';
import type { FaceUvShearMode } from '@/texture/uv/operations/face_uv_operation_shear.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import {
  FACE_ATTRIBUTES_UV_TOOL_ROWS_DEFAULT,
  faceAttributesUvToolButtonHighlightApply,
  type FaceAttributesUvToolButtonSpec,
} from './face_attributes_uv_tool_specs.js';

/** Callbacks the UV tool strip uses to run face UV operations. */
export interface FaceAttributesUvToolStripHandlers {
  onFit: (axis: FaceUvFitAxis) => void;
  onJustify: (side: FaceUvJustifySide) => void;
  onAlignEdge: (mode: FaceUvAlignEdgeMode) => void;
  onFlip: (axis: FaceUvFlipAxis) => void;
  onRotate: (degrees: number) => void;
  onResetFace: () => void;
  onResetWorld: () => void;
  onShearCommit: (mode: FaceUvShearMode, factor: number | null) => void;
}

/** One button whose highlight follows a status flag. */
interface UvToolStripButton {
  element: HTMLButtonElement;
  isHighlighted: (status: FaceUvToolSelectionStatus) => boolean;
}

/**
 * Compact strip of face UV tool button rows (by default fit, justify, align,
 * flip, rotate, resets) plus shear U/V numeric fields. Buttons with a highlight
 * flag highlight while the single selected face already satisfies them.
 */
export class FaceAttributesUvToolStrip {
  private readonly element: HTMLElement;
  private readonly handlers: FaceAttributesUvToolStripHandlers;
  private readonly buttons: UvToolStripButton[];
  private readonly shearUField: InputNumeric;
  private readonly shearVField: InputNumeric;

  /**
   * Creates the UV tool strip.
   *
   * @param handlers Operation callbacks.
   * @param buttonRows Button rows shown above the shear fields, top to bottom.
   */
  constructor(
    handlers: FaceAttributesUvToolStripHandlers,
    buttonRows: ReadonlyArray<readonly FaceAttributesUvToolButtonSpec[]> = FACE_ATTRIBUTES_UV_TOOL_ROWS_DEFAULT,
  ) {
    this.handlers = handlers;
    this.element = document.createElement('div');
    this.buttons = [];
    this.shearUField = this.shearFieldCreate('u-by-v');
    this.shearVField = this.shearFieldCreate('v-by-u');
    this.rootStyleApply();
    buttonRows.forEach((specs) => this.element.appendChild(this.specRowCreate(specs)));
    this.element.appendChild(this.shearRowCreate());
  }

  /**
   * Returns the strip element.
   *
   * @returns Strip DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Highlights the fit, justify, and align buttons whose condition the face
   * already satisfies.
   *
   * @param status Status of the single selected face, or null.
   */
  setFromStatus(status: FaceUvToolSelectionStatus | null): void {
    this.buttons.forEach((button) => {
      const highlighted = status !== null && button.isHighlighted(status);
      faceAttributesUvToolButtonHighlightApply(button.element, highlighted);
    });
  }

  /**
   * Shows the shared shear factors of the selection; mixed selections show
   * empty fields.
   *
   * @param shearU Shared U shear factor, or null.
   * @param shearV Shared V shear factor, or null.
   */
  setShearValues(shearU: number | null, shearV: number | null): void {
    this.shearUField.setNumber(shearU, 3);
    this.shearVField.setNumber(shearV, 3);
  }

  /** Releases the numeric field listeners. */
  dispose(): void {
    this.shearUField.dispose();
    this.shearVField.dispose();
  }

  /** Lays the strip out as wrapped rows inside the inspector padding. */
  private rootStyleApply(): void {
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    this.element.style.padding = `0 ${FACE_INSPECTOR_METRICS.paddingX}px ${FACE_INSPECTOR_METRICS.paddingY}px`;
  }

  /**
   * Creates one wrapping row of buttons built from specs.
   *
   * @param specs Button specs of the row.
   * @returns Row element.
   */
  private specRowCreate(specs: readonly FaceAttributesUvToolButtonSpec[]): HTMLElement {
    return this.rowCreate(...specs.map((spec) => this.specButtonCreate(spec)));
  }

  /**
   * Creates one button from its spec, tracking it for status highlighting when
   * the spec carries a highlight flag.
   *
   * @param spec Button spec.
   * @returns Button element.
   */
  private specButtonCreate(spec: FaceAttributesUvToolButtonSpec): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: spec.title,
      text: spec.title,
      widthPx: null,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick: () => spec.run(this.handlers),
    });
    if (spec.isHighlighted) {
      this.buttons.push({ element: button, isHighlighted: spec.isHighlighted });
    }
    return button;
  }

  /**
   * Creates the shear U and V field row.
   *
   * @returns Row element.
   */
  private shearRowCreate(): HTMLElement {
    const row = this.rowCreate(
      this.shearCellCreate('Shear U', this.shearUField),
      this.shearCellCreate('Shear V', this.shearVField),
    );
    return row;
  }

  /**
   * Wraps controls into one wrapping flex row.
   *
   * @param controls Controls of the row.
   * @returns Row element.
   */
  private rowCreate(...controls: HTMLElement[]): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    row.style.alignItems = 'center';
    controls.forEach((control) => row.appendChild(control));
    return row;
  }

  /**
   * Creates one shear numeric field bound to its shear mode.
   *
   * @param mode Which shear the field edits.
   * @returns Numeric field.
   */
  private shearFieldCreate(mode: FaceUvShearMode): InputNumeric {
    const field = new InputNumeric({
      step: 0.05,
      width: '56px',
      height: `${FACE_INSPECTOR_METRICS.controlHeight}px`,
      padding: '0 4px',
      textAlign: 'right',
      ariaLabel: `Shear ${mode === 'u-by-v' ? 'U' : 'V'}`,
    });
    field.bindCommit(() => this.handlers.onShearCommit(mode, field.parseNumberOrNull()));
    return field;
  }

  /**
   * Creates a labeled shear field cell.
   *
   * @param label Field label.
   * @param field Numeric field.
   * @returns Cell element.
   */
  private shearCellCreate(label: string, field: InputNumeric): HTMLElement {
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.alignItems = 'center';
    cell.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    cell.append(faceInspectorCaptionCreate(label), field.getElement());
    return cell;
  }
}
