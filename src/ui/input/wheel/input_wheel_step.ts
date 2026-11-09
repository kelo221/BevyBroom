/** Step multiplier while Shift is held over a wheel-stepped control. */
export const INPUT_WHEEL_STEP_SHIFT_MULTIPLIER = 10;

/** Step multiplier while Ctrl is held over a wheel-stepped control. */
export const INPUT_WHEEL_STEP_CTRL_MULTIPLIER = 0.1;

/** Rounding applied after a numeric step so repeated steps do not drift. */
const INPUT_WHEEL_STEP_VALUE_ROUNDING = 1e6;

/** Direction and size of one mouse wheel step over a control. */
export interface InputWheelStep {
  /** 1 when the wheel scrolled up, -1 when it scrolled down. */
  readonly direction: 1 | -1;
  /** Factor applied to the control's step size. */
  readonly multiplier: number;
}

/**
 * Resolves one wheel notch into a step: scrolling up gives direction 1,
 * scrolling down gives direction -1; Shift multiplies the step by ten and Ctrl
 * divides it by ten. Horizontal scrolling counts when there is no vertical
 * movement, since browsers report Shift+wheel horizontally.
 *
 * @param event Wheel event over the control.
 * @returns Step to apply, or null when the wheel did not move.
 */
export function inputWheelStepResolve(event: WheelEvent): InputWheelStep | null {
  const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
  if (delta === 0 || !Number.isFinite(delta)) {
    return null;
  }
  return { direction: delta < 0 ? 1 : -1, multiplier: inputWheelStepMultiplierRead(event) };
}

/**
 * Adds one scaled step to a number and rounds away floating point drift.
 *
 * @param currentValue Value before the step.
 * @param stepSize Size of one unscaled step.
 * @param direction 1 to add the step, -1 to remove it.
 * @param multiplier Factor applied to the step size.
 * @returns Stepped and rounded value.
 */
export function inputWheelStepValueApply(
  currentValue: number,
  stepSize: number,
  direction: 1 | -1,
  multiplier: number,
): number {
  const steppedValue = currentValue + direction * stepSize * multiplier;
  return Math.round(steppedValue * INPUT_WHEEL_STEP_VALUE_ROUNDING) / INPUT_WHEEL_STEP_VALUE_ROUNDING;
}

/**
 * Reads the step multiplier of the held modifier keys.
 *
 * @param event Wheel event carrying the modifier state.
 * @returns Shift, Ctrl or plain step multiplier.
 */
function inputWheelStepMultiplierRead(event: WheelEvent): number {
  if (event.shiftKey) {
    return INPUT_WHEEL_STEP_SHIFT_MULTIPLIER;
  }
  if (event.ctrlKey) {
    return INPUT_WHEEL_STEP_CTRL_MULTIPLIER;
  }
  return 1;
}
