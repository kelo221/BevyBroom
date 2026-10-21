import { InputNumeric } from '@/ui/input/input_numeric.js';

/** Axis names used in the accessible names of the component fields. */
const INPUT_VECTOR_AXIS_NAMES = ['X', 'Y', 'Z', 'W'];

/**
 * Row of numeric fields editing the components of a vector. Each component is
 * shared or mixed on its own across the bound objects.
 */
export class InputVector {
  private readonly element: HTMLElement;
  private readonly componentInputs: InputNumeric[];

  /**
   * Creates the fields.
   *
   * @param size Number of components, two to four.
   * @param ariaLabel Accessible name prefix.
   * @param step Arrow step of every field.
   */
  constructor(size: number, ariaLabel: string, step = 0.1) {
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.gap = '4px';
    this.componentInputs = [];
    for (let index = 0; index < size; index++) {
      const input = new InputNumeric({ step, width: '100%', minWidth: '0' });
      input.getElement().setAttribute('aria-label', `${ariaLabel} ${INPUT_VECTOR_AXIS_NAMES[index] ?? index}`);
      this.componentInputs.push(input);
      this.element.appendChild(input.getElement());
    }
  }

  /**
   * Returns the row element.
   *
   * @returns Row DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows each component's shared value.
   *
   * @param vectors Per-object vectors.
   * @param minDecimals Smallest number of decimals shown.
   */
  setSharedValues(vectors: readonly (readonly number[])[], minDecimals: number): void {
    this.componentInputs.forEach((input, index) => {
      input.setSharedValues(
        vectors.map((vector) => vector[index] ?? 0),
        minDecimals,
      );
    });
  }

  /**
   * Returns the parsed value of one component.
   *
   * @param index Component index.
   * @returns The number, or null when the text is not a valid number.
   */
  componentParse(index: number): number | null {
    return this.componentInputs[index]?.parseNumberOrNull() ?? null;
  }

  /**
   * Binds the handler called when the user commits one component.
   *
   * @param onCommit Receives the index of the committed component.
   */
  bindCommit(onCommit: (index: number) => void): void {
    this.componentInputs.forEach((input, index) => input.bindCommit(() => onCommit(index)));
  }
}
