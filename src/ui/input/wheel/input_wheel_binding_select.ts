import { InputWheelBinding } from './input_wheel_binding.js';
import { inputWheelListIndexStep } from './input_wheel_list_index.js';
import type { InputWheelStep } from './input_wheel_step.js';

/**
 * Wheel binding of a select: scrolling down chooses the next option and
 * scrolling up the previous one, skipping disabled and hidden options and
 * stopping at the list ends.
 */
export class InputWheelBindingSelect extends InputWheelBinding {
  private readonly select: HTMLSelectElement;

  /**
   * Binds the wheel over a select, or over an element around it, to the select.
   *
   * @param select Select whose option the wheel changes.
   * @param listenElement Element the pointer hovers while scrolling.
   */
  constructor(select: HTMLSelectElement, listenElement: HTMLElement = select) {
    super(listenElement);
    this.select = select;
  }

  /**
   * Returns whether the select is disabled.
   *
   * @returns True when the select ignores the wheel.
   */
  protected wheelIgnoredRead(): boolean {
    return this.select.disabled;
  }

  /**
   * Chooses the option one notch away and fires the select's change events.
   *
   * @param step Wheel step to apply.
   * @returns True when another option was chosen.
   */
  protected wheelStepApply(step: InputWheelStep): boolean {
    const options = this.select.options;
    const nextIndex = inputWheelListIndexStep(this.select.selectedIndex, options.length, step, (index) =>
      this.optionSelectableRead(options[index]),
    );
    if (nextIndex === null) {
      return false;
    }
    this.select.selectedIndex = nextIndex;
    this.userChangeEventsDispatch(this.select);
    return true;
  }

  /**
   * Returns whether an option may be chosen with the wheel.
   *
   * @param option Option to check.
   * @returns True when the option exists and is neither disabled nor hidden.
   */
  private optionSelectableRead(option: HTMLOptionElement | undefined): boolean {
    return option !== undefined && !option.disabled && !option.hidden;
  }
}
