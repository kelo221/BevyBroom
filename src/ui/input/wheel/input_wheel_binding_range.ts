import { InputWheelBinding } from './input_wheel_binding.js';
import { inputWheelStepValueApply, type InputWheelStep } from './input_wheel_step.js';

/** Step a range input uses when its step attribute holds no positive number. */
const INPUT_WHEEL_BINDING_RANGE_DEFAULT_STEP = 1;

/** Minimum a range input uses when its min attribute is empty. */
const INPUT_WHEEL_BINDING_RANGE_DEFAULT_MIN = 0;

/** Maximum a range input uses when its max attribute is empty. */
const INPUT_WHEEL_BINDING_RANGE_DEFAULT_MAX = 100;

/**
 * Wheel binding of a range input: scrolling up increases the value by one range
 * step and scrolling down decreases it, clamped to the range ends. Shift moves
 * ten steps; Ctrl cannot go finer than the range step, so it moves one.
 */
export class InputWheelBindingRange extends InputWheelBinding {
  private readonly range: HTMLInputElement;
  private readonly valueBlankRead: () => boolean;

  /**
   * Binds the wheel over a range input, or over an element around it, to the
   * range.
   *
   * @param range Range input whose value the wheel changes.
   * @param listenElement Element the pointer hovers while scrolling.
   * @param valueBlankRead Returns true while the control shows no value, such
   *   as a mixed selection, so the wheel leaves it alone.
   */
  constructor(
    range: HTMLInputElement,
    listenElement: HTMLElement = range,
    valueBlankRead: () => boolean = () => false,
  ) {
    super(listenElement);
    this.range = range;
    this.valueBlankRead = valueBlankRead;
  }

  /**
   * Returns whether the range is disabled or shows no value.
   *
   * @returns True when the range ignores the wheel.
   */
  protected wheelIgnoredRead(): boolean {
    return this.range.disabled || this.valueBlankRead();
  }

  /**
   * Moves the range by the scaled step and fires its change events.
   *
   * @param step Wheel step to apply.
   * @returns True when the range value changed.
   */
  protected wheelStepApply(step: InputWheelStep): boolean {
    const currentValue = Number(this.range.value);
    const multiplier = Math.max(1, step.multiplier);
    const steppedValue = inputWheelStepValueApply(currentValue, this.rangeStepRead(), step.direction, multiplier);
    this.range.value = String(this.rangeClamp(steppedValue));
    if (Number(this.range.value) === currentValue) {
      return false;
    }
    this.userChangeEventsDispatch(this.range);
    return true;
  }

  /**
   * Reads the step size of the range.
   *
   * @returns Positive step size.
   */
  private rangeStepRead(): number {
    const step = Number(this.range.step);
    return Number.isFinite(step) && step > 0 ? step : INPUT_WHEEL_BINDING_RANGE_DEFAULT_STEP;
  }

  /**
   * Clamps a value to the range's minimum and maximum.
   *
   * @param value Candidate value.
   * @returns Value between the range ends.
   */
  private rangeClamp(value: number): number {
    const minimum = this.range.min === '' ? INPUT_WHEEL_BINDING_RANGE_DEFAULT_MIN : Number(this.range.min);
    const maximum = this.range.max === '' ? INPUT_WHEEL_BINDING_RANGE_DEFAULT_MAX : Number(this.range.max);
    return Math.min(maximum, Math.max(minimum, value));
  }
}
