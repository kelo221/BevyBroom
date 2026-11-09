import { inputWheelStepResolve, type InputWheelStep } from './input_wheel_step.js';

/**
 * Steps a control on mouse wheel notches over an element. The page or panel
 * scroll is blocked only when the control consumed the step, so scrolling still
 * works at the ends of a range and over ignored controls.
 */
export abstract class InputWheelBinding {
  private readonly listenElement: HTMLElement;
  private readonly wheelListener: (event: WheelEvent) => void;

  /**
   * Starts listening for wheel events over an element.
   *
   * @param listenElement Element the pointer hovers while scrolling.
   */
  protected constructor(listenElement: HTMLElement) {
    this.listenElement = listenElement;
    this.wheelListener = (event) => this.wheelHandle(event);
    this.listenElement.addEventListener('wheel', this.wheelListener, { passive: false });
  }

  /** Stops listening for wheel events. */
  dispose(): void {
    this.listenElement.removeEventListener('wheel', this.wheelListener);
  }

  /**
   * Returns whether the control currently ignores the wheel.
   *
   * @returns True when the control is disabled or cannot step.
   */
  protected abstract wheelIgnoredRead(): boolean;

  /**
   * Applies one wheel step to the control and fires its user change path.
   *
   * @param step Wheel step to apply.
   * @returns True when the control's value changed.
   */
  protected abstract wheelStepApply(step: InputWheelStep): boolean;

  /**
   * Fires the bubbling input and change events a user edit of a form control
   * fires, so listeners bound to user edits run for wheel steps too.
   *
   * @param control Form control whose value the wheel changed.
   */
  protected userChangeEventsDispatch(control: HTMLElement): void {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Steps the control on one wheel event and blocks the scroll when consumed.
   *
   * @param event Wheel event over the listened element.
   */
  private wheelHandle(event: WheelEvent): void {
    const step = inputWheelStepResolve(event);
    if (!step || this.wheelIgnoredRead()) {
      return;
    }
    if (this.wheelStepApply(step)) {
      event.preventDefault();
    }
  }
}
