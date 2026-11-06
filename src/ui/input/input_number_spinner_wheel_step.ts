/** Step multiplier while Shift is held over a spinner. */
export const INPUT_NUMBER_SPINNER_WHEEL_SHIFT_MULTIPLIER = 10;

/** Step multiplier while Ctrl is held over a spinner. */
export const INPUT_NUMBER_SPINNER_WHEEL_CTRL_MULTIPLIER = 0.1;

/** Direction and size of one mouse wheel step over a spinner. */
export interface InputNumberSpinnerWheelStep {
  /** 1 to step up, -1 to step down. */
  readonly direction: 1 | -1;
  /** Factor applied to the spinner's step size. */
  readonly multiplier: number;
}

/**
 * Resolves one wheel notch into a spinner step: scrolling up steps up,
 * scrolling down steps down; Shift multiplies the step by ten and Ctrl divides
 * it by ten. Horizontal scrolling counts when there is no vertical movement,
 * since browsers report Shift+wheel horizontally.
 *
 * @param event Wheel event over the spinner.
 * @returns Step to apply, or null when the wheel did not move.
 */
export function inputNumberSpinnerWheelStepResolve(event: WheelEvent): InputNumberSpinnerWheelStep | null {
  const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
  if (delta === 0 || !Number.isFinite(delta)) {
    return null;
  }
  return { direction: delta < 0 ? 1 : -1, multiplier: inputNumberSpinnerWheelMultiplierRead(event) };
}

/**
 * Reads the step multiplier of the held modifier keys.
 *
 * @param event Wheel event carrying the modifier state.
 * @returns Shift, Ctrl or plain step multiplier.
 */
function inputNumberSpinnerWheelMultiplierRead(event: WheelEvent): number {
  if (event.shiftKey) {
    return INPUT_NUMBER_SPINNER_WHEEL_SHIFT_MULTIPLIER;
  }
  if (event.ctrlKey) {
    return INPUT_NUMBER_SPINNER_WHEEL_CTRL_MULTIPLIER;
  }
  return 1;
}
