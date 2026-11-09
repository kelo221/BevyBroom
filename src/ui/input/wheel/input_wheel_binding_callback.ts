import { InputWheelBinding } from './input_wheel_binding.js';
import type { InputWheelStep } from './input_wheel_step.js';

/** Callbacks that read and step a custom control. */
export interface InputWheelBindingCallbackHandlers {
  /**
   * Returns whether the control currently ignores the wheel.
   *
   * @returns True when the control is disabled or cannot step.
   */
  readonly wheelIgnoredRead: () => boolean;
  /**
   * Applies one wheel step to the control.
   *
   * @param step Wheel step to apply.
   * @returns True when the control's value changed.
   */
  readonly wheelStepApply: (step: InputWheelStep) => boolean;
}

/** Wheel binding for controls that step through their own callbacks. */
export class InputWheelBindingCallback extends InputWheelBinding {
  private readonly handlers: InputWheelBindingCallbackHandlers;

  /**
   * Binds the wheel over an element to a custom control.
   *
   * @param listenElement Element the pointer hovers while scrolling.
   * @param handlers Callbacks that read and step the control.
   */
  constructor(listenElement: HTMLElement, handlers: InputWheelBindingCallbackHandlers) {
    super(listenElement);
    this.handlers = handlers;
  }

  /**
   * Returns whether the control currently ignores the wheel.
   *
   * @returns Result of the ignore callback.
   */
  protected wheelIgnoredRead(): boolean {
    return this.handlers.wheelIgnoredRead();
  }

  /**
   * Applies one wheel step through the step callback.
   *
   * @param step Wheel step to apply.
   * @returns Result of the step callback.
   */
  protected wheelStepApply(step: InputWheelStep): boolean {
    return this.handlers.wheelStepApply(step);
  }
}
