import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import type { FaceUvFitAxis } from '@/texture/uv/operations/face_uv_operation_fit.js';
import type { FaceUvJustifySide } from '@/texture/uv/operations/face_uv_operation_justify.js';
import type { FaceUvAlignEdgeMode } from '@/texture/uv/operations/face_uv_operation_align_edge.js';
import type { FaceUvFlipAxis } from '@/texture/uv/operations/face_uv_operation_flip.js';
import type { FaceUvShearMode } from '@/texture/uv/operations/face_uv_operation_shear.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorButtonCreate,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';

/** Background tint of a highlighted (already satisfied) button. */
const UV_TOOL_HIGHLIGHT_BACKGROUND = 'rgba(232, 106, 23, 0.22)';

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
 * Compact strip of face UV tool buttons (fit, justify, align, flip, rotate,
 * resets) plus shear U/V numeric fields. Fit, justify, and align buttons
 * highlight while the single selected face already satisfies them.
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
   */
  constructor(handlers: FaceAttributesUvToolStripHandlers) {
    this.handlers = handlers;
    this.element = document.createElement('div');
    this.buttons = [];
    this.shearUField = this.shearFieldCreate('u-by-v');
    this.shearVField = this.shearFieldCreate('v-by-u');
    this.rootStyleApply();
    this.element.append(this.fitJustifyRowCreate(), this.alignFlipRowCreate(), this.shearRowCreate());
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
      faceUvToolButtonHighlightApply(button.element, highlighted);
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
   * Creates the fit and justify button row from its spec table.
   *
   * @returns Row element.
   */
  private fitJustifyRowCreate(): HTMLElement {
    return this.specRowCreate(FIT_JUSTIFY_BUTTON_SPECS);
  }

  /**
   * Creates the align, flip, rotate, and reset button row from its spec table.
   *
   * @returns Row element.
   */
  private alignFlipRowCreate(): HTMLElement {
    return this.specRowCreate(ALIGN_FLIP_BUTTON_SPECS);
  }

  /**
   * Creates one wrapping row of buttons built from specs.
   *
   * @param specs Button specs of the row.
   * @returns Row element.
   */
  private specRowCreate(specs: readonly UvToolStripButtonSpec[]): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    row.style.alignItems = 'center';
    specs.forEach((spec) => row.appendChild(this.specButtonCreate(spec)));
    return row;
  }

  /**
   * Creates one button from its spec, tracking it for status highlighting when
   * the spec carries a highlight flag.
   *
   * @param spec Button spec.
   * @returns Button element.
   */
  private specButtonCreate(spec: UvToolStripButtonSpec): HTMLButtonElement {
    const button = faceInspectorButtonCreate({
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

/** Declarative description of one tool strip button. */
interface UvToolStripButtonSpec {
  /** Button label and tooltip. */
  title: string;
  /** Runs the button's operation against the strip handlers. */
  run: (handlers: FaceAttributesUvToolStripHandlers) => void;
  /** Highlight flag read from the selection status, when tracked. */
  isHighlighted?: (status: FaceUvToolSelectionStatus) => boolean;
}

/** Fit and justify buttons with their status highlight flags. */
const FIT_JUSTIFY_BUTTON_SPECS: readonly UvToolStripButtonSpec[] = [
  { title: 'Fit H', run: (h) => h.onFit('u'), isHighlighted: (s) => s.fittedU },
  { title: 'Fit V', run: (h) => h.onFit('v'), isHighlighted: (s) => s.fittedV },
  { title: 'Fit', run: (h) => h.onFit('both'), isHighlighted: (s) => s.fittedU && s.fittedV },
  { title: 'Justify ←', run: (h) => h.onJustify('left'), isHighlighted: (s) => s.justifiedLeft },
  { title: 'Justify →', run: (h) => h.onJustify('right'), isHighlighted: (s) => s.justifiedRight },
  { title: 'Justify ↑', run: (h) => h.onJustify('top'), isHighlighted: (s) => s.justifiedTop },
  { title: 'Justify ↓', run: (h) => h.onJustify('bottom'), isHighlighted: (s) => s.justifiedBottom },
  { title: 'Center', run: (h) => h.onJustify('center'), isHighlighted: (s) => s.justifiedCenter },
];

/** Align, flip, rotate, and reset buttons with their status highlight flags. */
const ALIGN_FLIP_BUTTON_SPECS: readonly UvToolStripButtonSpec[] = [
  { title: 'Align ◀', run: (h) => h.onAlignEdge('previous'), isHighlighted: (s) => s.aligned },
  { title: 'Align', run: (h) => h.onAlignEdge('best'), isHighlighted: (s) => s.aligned },
  { title: 'Align ▶', run: (h) => h.onAlignEdge('next'), isHighlighted: (s) => s.aligned },
  { title: 'Flip H', run: (h) => h.onFlip('horizontal') },
  { title: 'Flip V', run: (h) => h.onFlip('vertical') },
  { title: 'Rot −90', run: (h) => h.onRotate(-90) },
  { title: 'Rot 90', run: (h) => h.onRotate(90) },
  { title: 'Reset Face', run: (h) => h.onResetFace() },
  { title: 'Reset World', run: (h) => h.onResetWorld() },
];

/**
 * Paints a tool button as highlighted (already satisfied) or idle.
 *
 * @param button Button element.
 * @param highlighted Whether the condition is satisfied.
 */
function faceUvToolButtonHighlightApply(button: HTMLButtonElement, highlighted: boolean): void {
  button.style.borderColor = highlighted ? hexToRgb(Theme.selectionColor) : Theme.inputBorderColor;
  button.style.background = highlighted ? UV_TOOL_HIGHLIGHT_BACKGROUND : hexToRgb(Theme.buttonBackground);
}
