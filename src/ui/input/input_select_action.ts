import type { InputSelectChoice } from './input_select.js';
import { InputSelectBase } from './input_select_base.js';

/**
 * Themed action picker: every choice runs an action through the commit handler
 * instead of storing a value, so the mouse wheel never changes it.
 */
export class InputSelectAction extends InputSelectBase {
  /**
   * Creates an action picker and fills it.
   *
   * @param choices Entries, usually a prompt followed by the actions.
   * @param ariaLabel Accessible name.
   */
  constructor(choices: readonly InputSelectChoice[], ariaLabel: string) {
    super(choices, ariaLabel);
  }
}
