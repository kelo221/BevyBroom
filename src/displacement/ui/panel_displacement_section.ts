import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import type { InputNumeric } from '@/ui/input/input_numeric.js';

/**
 * One group of Displacement tab controls bound to the shared displacement
 * sculpt settings.
 */
export abstract class PanelDisplacementSection {
  protected readonly element: HTMLElement;
  private readonly numericInputs: InputNumeric[] = [];

  /** Creates the section container. */
  constructor() {
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the given settings in the section's fields.
   *
   * @param settings Current displacement sculpt settings.
   */
  abstract settingsShow(settings: Readonly<DisplacementSculptSettings>): void;

  /** Removes the listeners of the section's numeric fields. */
  dispose(): void {
    this.numericInputs.forEach((input) => input.dispose());
    this.numericInputs.length = 0;
  }

  /**
   * Registers a numeric field so dispose releases it.
   *
   * @param input Numeric field owned by the section.
   * @returns The same field.
   */
  protected numericInputOwn(input: InputNumeric): InputNumeric {
    this.numericInputs.push(input);
    return input;
  }

  /**
   * Stores a positive number typed into a field in the shared settings.
   *
   * @param input Numeric field.
   * @param key Settings entry the field edits.
   */
  protected positiveSettingCommit(input: InputNumeric, key: 'radius' | 'distance'): void {
    const value = input.parseNumberOrNull();
    if (value === null || value <= 0) {
      this.settingsShow(getStateDisplacementSculpt().settingsRead());
      return;
    }
    getStateDisplacementSculpt().settingsWrite(key === 'radius' ? { radius: value } : { distance: value });
  }
}
