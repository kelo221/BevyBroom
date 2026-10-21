import type { FaceTextureMappingTrs } from '@/texture/uv/face_texture_mapping.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import type { UvRelativeTrsOp } from '@/texture/uv/uv_trs_ops.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorButtonCreate,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import {
  FACE_ATTRIBUTES_ROWS,
  type FaceAttributesFieldSpec,
  type FaceAttributesRowSpec,
} from './face_attributes_field_specs.js';

/** Callbacks the face attribute grid uses to apply edits. */
export interface FaceAttributesFieldGridHandlers {
  /** Applies the typed values; only the listed fields change. */
  onFieldsCommit: (fields: Partial<FaceTextureMappingTrs>) => void;
  /** Applies a nudge to every selected face. */
  onRelativeOp: (op: UvRelativeTrsOp) => void;
}

/** One created field with the spec it was built from. */
interface FaceAttributesFieldEntry {
  spec: FaceAttributesFieldSpec;
  input: InputNumeric;
}

/**
 * Compact two-column grid of labeled numeric face attributes (offset, scale,
 * rotation) with a pair of nudge buttons beside every field.
 */
export class FaceAttributesFieldGrid {
  private readonly element: HTMLElement;
  private readonly handlers: FaceAttributesFieldGridHandlers;
  private readonly fieldEntries: FaceAttributesFieldEntry[];

  /**
   * Creates the grid and its fields.
   *
   * @param handlers Edit callbacks.
   */
  constructor(handlers: FaceAttributesFieldGridHandlers) {
    this.handlers = handlers;
    this.fieldEntries = [];
    this.element = document.createElement('div');
    this.gridStyleApply();
    this.gridHeaderAppend();
    FACE_ATTRIBUTES_ROWS.forEach((row) => this.gridRowAppend(row));
  }

  /**
   * Returns the grid element.
   *
   * @returns Grid DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows shared values and mixed dashes in every field.
   *
   * @param fields Per-field state where null means mixed.
   */
  setFromFieldState(fields: UvEditorTrsFieldState): void {
    this.fieldEntries.forEach((entry) => {
      entry.input.setNumber(fields[entry.spec.key], entry.spec.decimals);
    });
  }

  /** Removes the listeners of every field. */
  dispose(): void {
    this.fieldEntries.forEach((entry) => entry.input.dispose());
  }

  /** Applies the label column plus two equal field columns. */
  private gridStyleApply(): void {
    this.element.style.display = 'grid';
    this.element.style.gridTemplateColumns = 'auto minmax(0, 1fr) minmax(0, 1fr)';
    this.element.style.columnGap = `${FACE_INSPECTOR_METRICS.gap + 2}px`;
    this.element.style.rowGap = `${FACE_INSPECTOR_METRICS.gap}px`;
    this.element.style.alignItems = 'center';
    this.element.style.padding = `${FACE_INSPECTOR_METRICS.paddingY}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    this.element.style.boxSizing = 'border-box';
    this.element.style.width = '100%';
  }

  /** Appends the X / Y column headings. */
  private gridHeaderAppend(): void {
    this.element.appendChild(document.createElement('span'));
    this.element.appendChild(this.columnHeadingCreate('X'));
    this.element.appendChild(this.columnHeadingCreate('Y'));
  }

  /**
   * Creates one centered column heading.
   *
   * @param text Heading text.
   * @returns Heading element.
   */
  private columnHeadingCreate(text: string): HTMLElement {
    const heading = faceInspectorCaptionCreate(text);
    heading.style.textAlign = 'center';
    return heading;
  }

  /**
   * Appends a row caption, its fields and an empty filler for a missing Y.
   *
   * @param row Row spec.
   */
  private gridRowAppend(row: FaceAttributesRowSpec): void {
    this.element.appendChild(faceInspectorCaptionCreate(row.label));
    row.fields.forEach((spec) => this.element.appendChild(this.fieldCellCreate(spec)));
    if (row.fields.length < 2) {
      this.element.appendChild(document.createElement('span'));
    }
  }

  /**
   * Creates one cell holding a numeric field and its two nudge buttons.
   *
   * @param spec Field spec.
   * @returns Cell element.
   */
  private fieldCellCreate(spec: FaceAttributesFieldSpec): HTMLElement {
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.gap = '2px';
    cell.style.minWidth = '0';
    cell.appendChild(this.fieldInputCreate(spec).getElement());
    spec.nudges.forEach((nudge) => {
      cell.appendChild(
        faceInspectorButtonCreate({
          title: nudge.title,
          text: nudge.text,
          widthPx: FACE_INSPECTOR_METRICS.nudgeWidth,
          heightPx: FACE_INSPECTOR_METRICS.controlHeight,
          onClick: () => this.handlers.onRelativeOp(nudge.op),
        }),
      );
    });
    return cell;
  }

  /**
   * Creates a numeric field that fills its cell and commits on change.
   *
   * @param spec Field spec.
   * @returns Numeric field.
   */
  private fieldInputCreate(spec: FaceAttributesFieldSpec): InputNumeric {
    const input = new InputNumeric({
      step: spec.step,
      width: '100%',
      minWidth: '0',
      height: `${FACE_INSPECTOR_METRICS.controlHeight}px`,
      padding: '0 4px',
      textAlign: 'right',
      ariaLabel: spec.ariaLabel,
    });
    input.getElement().style.flex = '1 1 auto';
    input.bindCommit(() => this.fieldsCommitFromInputs());
    this.fieldEntries.push({ spec, input });
    return input;
  }

  /** Emits every field that parses to a number, leaving mixed fields alone. */
  private fieldsCommitFromInputs(): void {
    const fields: Partial<FaceTextureMappingTrs> = {};
    this.fieldEntries.forEach((entry) => {
      const value = entry.input.parseNumberOrNull();
      if (value !== null) {
        fields[entry.spec.key] = value;
      }
    });
    if (Object.keys(fields).length === 0) {
      return;
    }
    this.handlers.onFieldsCommit(fields);
  }
}
