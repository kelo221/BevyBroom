import { Theme } from '@/theme.js';
import type { SurfaceUvVectors2x3 } from '@/texture/uv_matrix/surface_uv_matrix_vectors.js';

/** Callbacks invoked by the 2×3 UV vector inputs. */
export interface FaceEditSheetVectorsRowHandlers {
  /** Commits updated 2×3 U and V projection axis vectors. */
  onVectorsCommit?: (vectors: SurfaceUvVectors2x3) => void;
}

/**
 * Renders Hammer++'s 2×3 Texture Vector (`U: X Y Z`, `V: X Y Z`) inputs inside
 * the floating Face Edit Sheet.
 */
export class FaceEditSheetVectorsRow {
  private readonly root: HTMLElement;
  private readonly uInputs: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private readonly vInputs: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
  private readonly handlers: FaceEditSheetVectorsRowHandlers;

  /**
   * Creates the 2×3 UV vectors control block.
   *
   * @param ownerDocument Document used to build DOM elements.
   * @param handlers Commit callbacks.
   */
  constructor(ownerDocument: Document, handlers: FaceEditSheetVectorsRowHandlers) {
    this.handlers = handlers;
    this.root = ownerDocument.createElement('div');
    this.uInputs = [
      this.createAxisInput(ownerDocument, 'u-x', '1'),
      this.createAxisInput(ownerDocument, 'u-y', '0'),
      this.createAxisInput(ownerDocument, 'u-z', '0'),
    ];
    this.vInputs = [
      this.createAxisInput(ownerDocument, 'v-x', '0'),
      this.createAxisInput(ownerDocument, 'v-y', '1'),
      this.createAxisInput(ownerDocument, 'v-z', '0'),
    ];
    this.buildLayout(ownerDocument);
  }

  /**
   * Returns the root DOM element.
   *
   * @returns Root element.
   */
  elementRead(): HTMLElement {
    return this.root;
  }

  /**
   * Populates the 2×3 UV vector inputs from a `SurfaceUvVectors2x3` value.
   *
   * @param vectors U and V direction vectors, or null to leave unchanged.
   */
  vectorsWrite(vectors: SurfaceUvVectors2x3 | null): void {
    if (!vectors) {
      return;
    }
    this.uInputs[0].value = String(vectors.uAxis[0]);
    this.uInputs[1].value = String(vectors.uAxis[1]);
    this.uInputs[2].value = String(vectors.uAxis[2]);
    this.vInputs[0].value = String(vectors.vAxis[0]);
    this.vInputs[1].value = String(vectors.vAxis[1]);
    this.vInputs[2].value = String(vectors.vAxis[2]);
  }

  /**
   * Reads the current 2×3 UV vector inputs.
   *
   * @returns Parsed `SurfaceUvVectors2x3`.
   */
  vectorsRead(): SurfaceUvVectors2x3 {
    return {
      uAxis: [
        this.parseAxisInput(this.uInputs[0], 1),
        this.parseAxisInput(this.uInputs[1], 0),
        this.parseAxisInput(this.uInputs[2], 0),
      ],
      vAxis: [
        this.parseAxisInput(this.vInputs[0], 0),
        this.parseAxisInput(this.vInputs[1], 1),
        this.parseAxisInput(this.vInputs[2], 0),
      ],
    };
  }

  /**
   * Builds the U and V vector rows.
   *
   * @param doc Owner document.
   */
  private buildLayout(doc: Document): void {
    this.root.className = 'face-edit-sheet-vectors-block';
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.gap = '4px';
    this.root.append(
      this.buildVectorAxisRow(doc, 'U:', this.uInputs),
      this.buildVectorAxisRow(doc, 'V:', this.vInputs),
    );
  }

  /**
   * Builds one 3-component vector row (`U` or `V`).
   *
   * @param doc Owner document.
   * @param label Row label.
   * @param inputs XYZ input triplet.
   * @returns Row element.
   */
  private buildVectorAxisRow(
    doc: Document,
    label: string,
    inputs: [HTMLInputElement, HTMLInputElement, HTMLInputElement],
  ): HTMLElement {
    const row = doc.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '16px 1fr 1fr 1fr';
    row.style.gap = '4px';
    row.style.alignItems = 'center';
    const span = doc.createElement('span');
    span.textContent = label;
    span.style.fontSize = '11px';
    span.style.fontFamily = Theme.uiFontFamily;
    span.style.color = Theme.statusBarTextColor;
    row.append(span, inputs[0], inputs[1], inputs[2]);
    return row;
  }

  /**
   * Creates one numeric axis component input.
   *
   * @param doc Owner document.
   * @param axisKey Data attribute key.
   * @param initialValue Initial string value.
   * @returns Input element.
   */
  private createAxisInput(doc: Document, axisKey: string, initialValue: string): HTMLInputElement {
    const input = doc.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.value = initialValue;
    input.dataset['uvVectorAxis'] = axisKey;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.height = '22px';
    input.style.background = Theme.inputBackgroundColor;
    input.style.color = Theme.inputTextColor;
    input.style.border = `1px solid ${Theme.inputBorderColor}`;
    input.style.borderRadius = '2px';
    input.style.fontSize = '11px';
    input.style.fontFamily = 'monospace';
    input.style.padding = '0 4px';
    input.addEventListener('change', () => {
      this.handlers.onVectorsCommit?.(this.vectorsRead());
    });
    return input;
  }

  /**
   * Parses an axis input or falls back when non-finite.
   *
   * @param input Input element.
   * @param fallback Fallback float.
   * @returns Parsed number.
   */
  private parseAxisInput(input: HTMLInputElement, fallback: number): number {
    const parsed = Number.parseFloat(input.value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
