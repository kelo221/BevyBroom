import { InputSelectBase } from './input_select_base.js';
import { InputWheelBindingSelect } from './wheel/input_wheel_binding_select.js';

/** One entry in a select field. */
export interface InputSelectChoice {
  /** Stored value. */
  value: string;
  /** Visible label. */
  label: string;
  /** Hover text. Empty when the entry has no extra explanation. */
  title?: string;
}

/**
 * Themed value select of inspector rows. The mouse wheel over it chooses the
 * next or previous entry and commits it like a user choice.
 */
export class InputSelect extends InputSelectBase {
  private readonly wheelBinding: InputWheelBindingSelect;

  /**
   * Creates a value select, fills it and binds the mouse wheel.
   *
   * @param choices Selectable entries.
   * @param ariaLabel Accessible name.
   */
  constructor(choices: readonly InputSelectChoice[], ariaLabel: string) {
    super(choices, ariaLabel);
    this.wheelBinding = new InputWheelBindingSelect(this.getElement());
  }

  /** Removes the wheel, change and commit listeners. */
  override dispose(): void {
    this.wheelBinding.dispose();
    super.dispose();
  }
}
