import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { InputNumeric, type InputNumericOptions } from './input_numeric.js';

/** Width of the up / down stepper column in pixels. */
const INPUT_NUMBER_SPINNER_STEPPER_WIDTH_PX = 14;

/** Default overall spinner height in pixels. */
const INPUT_NUMBER_SPINNER_DEFAULT_HEIGHT_PX = 22;

/** Rounding applied after a step so repeated steps do not drift. */
const INPUT_NUMBER_SPINNER_STEP_ROUNDING = 1e6;

/** Step size, display precision and layout of a number spinner. */
export interface InputNumberSpinnerOptions extends Omit<InputNumericOptions, 'height'> {
  /** Amount one up or down step adds or removes. */
  readonly step: number;
  /** Minimum fractional digits shown after a step. */
  readonly decimals: number;
  /** Overall spinner height in pixels. */
  readonly heightPx?: number;
}

/** Direction of one spinner step. */
export type InputNumberSpinnerDirection = 1 | -1;

/**
 * Numeric field with up / down stepper buttons on its right. A step (button, or
 * the Arrow Up / Arrow Down keys in the field) adds or removes the step size
 * and commits like a typed value. Mixed (dash) values do not step.
 */
export class InputNumberSpinner extends InputNumeric {
  private readonly spinnerRoot: HTMLElement;
  private readonly spinnerStep: number;
  private readonly spinnerDecimals: number;
  private readonly arrowKeyHandler: (event: KeyboardEvent) => void;

  /**
   * Creates the spinner: the numeric field and its stepper column.
   *
   * @param options Step size, display precision and layout.
   */
  constructor(options: InputNumberSpinnerOptions) {
    const heightPx = options.heightPx ?? INPUT_NUMBER_SPINNER_DEFAULT_HEIGHT_PX;
    super({ ...options, height: `${heightPx}px` });
    this.spinnerStep = options.step;
    this.spinnerDecimals = options.decimals;
    this.arrowKeyHandler = (event) => this.arrowKeyStep(event);
    this.spinnerRoot = this.spinnerRootCreate(options, heightPx);
    this.getElement().addEventListener('keydown', this.arrowKeyHandler);
  }

  /**
   * Returns the spinner root holding the field and the stepper buttons.
   *
   * @returns Spinner root element.
   */
  spinnerElementRead(): HTMLElement {
    return this.spinnerRoot;
  }

  /**
   * Adds or removes one step and commits the new value.
   *
   * @param direction 1 to step up, -1 to step down.
   * @returns True when the field held a number and stepped.
   */
  stepBy(direction: InputNumberSpinnerDirection): boolean {
    const current = this.parseNumberOrNull();
    if (current === null) {
      return false;
    }
    const next = Math.round((current + direction * this.spinnerStep) * INPUT_NUMBER_SPINNER_STEP_ROUNDING);
    this.setNumber(next / INPUT_NUMBER_SPINNER_STEP_ROUNDING, this.spinnerDecimals);
    this.getElement().dispatchEvent(new Event('change'));
    return true;
  }

  /** Removes the arrow key, focus and commit listeners. */
  override dispose(): void {
    this.getElement().removeEventListener('keydown', this.arrowKeyHandler);
    super.dispose();
  }

  /**
   * Steps on Arrow Up / Arrow Down pressed in the field.
   *
   * @param event Keyboard event of the field.
   */
  private arrowKeyStep(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    this.stepBy(event.key === 'ArrowUp' ? 1 : -1);
  }

  /**
   * Creates the root row holding the field and the stepper column.
   *
   * @param options Spinner options with the width overrides.
   * @param heightPx Overall height in pixels.
   * @returns Root element.
   */
  private spinnerRootCreate(options: InputNumberSpinnerOptions, heightPx: number): HTMLElement {
    const root = document.createElement('div');
    root.classList.add('input-number-spinner');
    root.style.display = 'flex';
    root.style.alignItems = 'stretch';
    root.style.height = `${heightPx}px`;
    root.style.width = options.width ?? '100%';
    root.style.minWidth = '0';
    root.style.boxSizing = 'border-box';
    this.getElement().style.width = 'auto';
    this.getElement().style.flex = '1 1 auto';
    this.getElement().style.minWidth = '0';
    root.append(this.getElement(), this.stepperColumnCreate(heightPx));
    return root;
  }

  /**
   * Creates the column of the up and down stepper buttons.
   *
   * @param heightPx Overall height in pixels.
   * @returns Column element.
   */
  private stepperColumnCreate(heightPx: number): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.flex = `0 0 ${INPUT_NUMBER_SPINNER_STEPPER_WIDTH_PX}px`;
    const label = this.getElement().getAttribute('aria-label') ?? 'value';
    column.append(
      this.stepperButtonCreate(`Increase ${label}`, '▴', 1, heightPx),
      this.stepperButtonCreate(`Decrease ${label}`, '▾', -1, heightPx),
    );
    return column;
  }

  /**
   * Creates one stepper button.
   *
   * @param title Accessible name and tooltip.
   * @param text Arrow glyph.
   * @param direction Step direction the button applies.
   * @param heightPx Overall spinner height in pixels.
   * @returns Button element.
   */
  private stepperButtonCreate(
    title: string,
    text: string,
    direction: InputNumberSpinnerDirection,
    heightPx: number,
  ): HTMLButtonElement {
    const button = buttonCompactCreate({
      title,
      text,
      widthPx: INPUT_NUMBER_SPINNER_STEPPER_WIDTH_PX,
      heightPx: Math.floor(heightPx / 2),
      onClick: () => this.stepBy(direction),
    });
    button.classList.add(direction === 1 ? 'input-number-spinner-up' : 'input-number-spinner-down');
    button.tabIndex = -1;
    button.style.flex = '1 1 0';
    return button;
  }
}
