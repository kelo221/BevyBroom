import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** One entry of a radio group. */
export interface InputRadioGroupChoice<Value extends string> {
  /** Stored value. */
  readonly value: Value;
  /** Visible label. */
  readonly label: string;
}

/** Direction the entries of a radio group are laid out in. */
export type InputRadioGroupDirection = 'row' | 'column';

/** Counter giving every radio group a unique input name. */
let inputRadioGroupNameCounter = 0;

/**
 * Themed set of labelled radio buttons. No entry is checked while the shown
 * values differ.
 */
export class InputRadioGroup<Value extends string> {
  private readonly element: HTMLElement;
  private readonly radios: ReadonlyMap<Value, HTMLInputElement>;
  private readonly clickListener: () => void;
  private commitHandler: (() => void) | null = null;

  /**
   * Creates the radio group.
   *
   * @param choices Entries in display order.
   * @param ariaLabel Accessible name of the group.
   * @param direction Whether the entries sit side by side or stacked.
   */
  constructor(
    choices: readonly InputRadioGroupChoice<Value>[],
    ariaLabel: string,
    direction: InputRadioGroupDirection = 'column',
  ) {
    inputRadioGroupNameCounter += 1;
    const groupName = `input-radio-group-${inputRadioGroupNameCounter}`;
    this.clickListener = () => this.commitHandler?.();
    this.radios = new Map(choices.map((choice) => [choice.value, this.radioCreate(choice, groupName)]));
    this.element = this.groupElementCreate(ariaLabel, direction);
    choices.forEach((choice) => this.element.append(this.radioLabelCreate(choice)));
  }

  /**
   * Returns the group element.
   *
   * @returns Group root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Returns the checked value.
   *
   * @returns Checked value, or null when no entry is checked.
   */
  getValue(): Value | null {
    for (const [value, radio] of this.radios) {
      if (radio.checked) {
        return value;
      }
    }
    return null;
  }

  /**
   * Checks the shared value, or clears every entry when the values differ or
   * the list is empty.
   *
   * @param values Per-object values.
   */
  setSharedValues(values: readonly Value[]): void {
    const first = values[0];
    const isMixed = first === undefined || values.some((value) => value !== first);
    this.radios.forEach((radio, value) => {
      radio.checked = !isMixed && value === first;
    });
  }

  /**
   * Binds the handler called when the user checks an entry.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.commitHandler = onCommit;
  }

  /** Removes the click listeners and drops the commit handler. */
  dispose(): void {
    this.radios.forEach((radio) => radio.removeEventListener('click', this.clickListener));
    this.commitHandler = null;
  }

  /**
   * Creates the group container.
   *
   * @param ariaLabel Accessible name of the group.
   * @param direction Layout direction of the entries.
   * @returns Group element.
   */
  private groupElementCreate(ariaLabel: string, direction: InputRadioGroupDirection): HTMLElement {
    const group = document.createElement('div');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', ariaLabel);
    group.style.display = 'flex';
    group.style.flexDirection = direction;
    group.style.flexWrap = 'wrap';
    group.style.gap = direction === 'row' ? '8px' : '2px';
    return group;
  }

  /**
   * Creates the radio input of one entry.
   *
   * @param choice Entry.
   * @param groupName Input name shared by the group's entries.
   * @returns Radio input.
   */
  private radioCreate(choice: InputRadioGroupChoice<Value>, groupName: string): HTMLInputElement {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = groupName;
    radio.value = choice.value;
    radio.setAttribute('aria-label', choice.label);
    radio.style.accentColor = hexToRgb(Theme.selectionColor);
    radio.style.margin = '0';
    radio.style.cursor = 'pointer';
    radio.addEventListener('click', this.clickListener);
    return radio;
  }

  /**
   * Wraps the radio of one entry and its text into one clickable label.
   *
   * @param choice Entry.
   * @returns Label element.
   */
  private radioLabelCreate(choice: InputRadioGroupChoice<Value>): HTMLLabelElement {
    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '4px';
    label.style.fontFamily = Theme.uiFontFamily;
    label.style.fontSize = '11px';
    label.style.color = Theme.buttonTextColor;
    label.style.cursor = 'pointer';
    label.style.whiteSpace = 'nowrap';
    const text = document.createElement('span');
    text.textContent = choice.label;
    const radio = this.radios.get(choice.value);
    label.append(...(radio ? [radio, text] : [text]));
    return label;
  }
}
