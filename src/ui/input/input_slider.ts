import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { InputNumeric } from './input_numeric.js';
import { InputWheelBindingRange } from './wheel/input_wheel_binding_range.js';

/** Range, precision and layout of a slider. */
export interface InputSliderOptions {
  /** Accessible name of the range; the number box is named "<name> value". */
  readonly ariaLabel: string;
  /** Smallest value. */
  readonly min: number;
  /** Largest value. */
  readonly max: number;
  /** Step of the range. */
  readonly step: number;
  /** Minimum fractional digits shown in the number box. */
  readonly decimals: number;
  /** CSS width of the number box. */
  readonly numericWidth?: string;
}

/**
 * Range slider paired with a numeric box. Dragging updates the box live;
 * releasing the slider or committing the box commits the value, clamped to the
 * slider range. The mouse wheel over the row steps the slider and commits.
 */
export class InputSlider {
  private readonly element: HTMLElement;
  private readonly range: HTMLInputElement;
  private readonly numeric: InputNumeric;
  private readonly rangeInputListener: () => void;
  private readonly rangeChangeListener: () => void;
  private readonly wheelBinding: InputWheelBindingRange;
  private commitHandler: (() => void) | null = null;

  /**
   * Creates the slider and its number box.
   *
   * @param options Range, precision and layout.
   */
  constructor(private readonly options: InputSliderOptions) {
    this.range = this.rangeCreate();
    this.numeric = new InputNumeric({
      ariaLabel: `${options.ariaLabel} value`,
      width: options.numericWidth ?? '56px',
      step: options.step,
    });
    this.rangeInputListener = () => this.numericFromRangeWrite();
    this.rangeChangeListener = () => this.rangeCommit();
    this.range.addEventListener('input', this.rangeInputListener);
    this.range.addEventListener('change', this.rangeChangeListener);
    this.numeric.bindCommit(() => this.numericCommit());
    this.element = this.rowCreate();
    this.wheelBinding = new InputWheelBindingRange(this.range, this.element, () => this.getValue() === null);
  }

  /**
   * Returns the row holding the slider and the number box.
   *
   * @returns Slider root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Returns the shown value.
   *
   * @returns Value clamped to the slider range, or null when the box holds no
   *   number.
   */
  getValue(): number | null {
    const value = this.numeric.parseNumberOrNull();
    return value === null ? null : this.valueClamp(value);
  }

  /**
   * Shows a value, or a blank box when the value is mixed.
   *
   * @param value Value to show, or null when mixed.
   */
  setNumber(value: number | null): void {
    this.numeric.setNumber(value === null ? null : this.valueClamp(value), this.options.decimals);
    this.range.value = String(value === null ? this.options.min : this.valueClamp(value));
  }

  /**
   * Shows the shared value of several objects, or a blank box when they differ.
   *
   * @param values Per-object values.
   */
  setSharedValues(values: readonly number[]): void {
    const first = values[0];
    const isMixed = first === undefined || values.some((value) => value !== first);
    this.setNumber(isMixed || first === undefined ? null : first);
  }

  /**
   * Binds the handler called when the user releases the slider or commits the
   * number box.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.commitHandler = onCommit;
  }

  /** Removes the slider, wheel and number box listeners. */
  dispose(): void {
    this.range.removeEventListener('input', this.rangeInputListener);
    this.range.removeEventListener('change', this.rangeChangeListener);
    this.wheelBinding.dispose();
    this.numeric.dispose();
    this.commitHandler = null;
  }

  /**
   * Clamps a value to the slider range.
   *
   * @param value Candidate value.
   * @returns Value between the slider minimum and maximum.
   */
  private valueClamp(value: number): number {
    return Math.min(this.options.max, Math.max(this.options.min, value));
  }

  /** Copies the slider position into the number box while dragging. */
  private numericFromRangeWrite(): void {
    this.numeric.setNumber(this.valueClamp(Number(this.range.value)), this.options.decimals);
  }

  /** Copies the released slider position into the number box and commits it. */
  private rangeCommit(): void {
    this.numericFromRangeWrite();
    this.commitHandler?.();
  }

  /** Shows the clamped typed value on the slider and commits it. */
  private numericCommit(): void {
    const value = this.getValue();
    if (value !== null) {
      this.setNumber(value);
    }
    this.commitHandler?.();
  }

  /**
   * Creates the range input.
   *
   * @returns Range input.
   */
  private rangeCreate(): HTMLInputElement {
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(this.options.min);
    range.max = String(this.options.max);
    range.step = String(this.options.step);
    range.setAttribute('aria-label', this.options.ariaLabel);
    range.style.flex = '1 1 auto';
    range.style.minWidth = '0';
    range.style.margin = '0';
    range.style.accentColor = hexToRgb(Theme.toggleAccentColor);
    range.style.cursor = 'pointer';
    return range;
  }

  /**
   * Creates the row holding the slider and the number box.
   *
   * @returns Row element.
   */
  private rowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'input-slider';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.minWidth = '0';
    row.append(this.range, this.numeric.getElement());
    return row;
  }
}
