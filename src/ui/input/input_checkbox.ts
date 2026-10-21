import { Theme } from '@/theme.js';

/** Themed checkbox used by inspector rows. Mixed values show as indeterminate. */
export class InputCheckbox {
  private readonly element: HTMLInputElement;
  private commitHandler: (() => void) | null;

  /**
   * Creates a checkbox.
   *
   * @param ariaLabel Accessible name.
   */
  constructor(ariaLabel: string) {
    this.element = document.createElement('input');
    this.element.type = 'checkbox';
    this.element.setAttribute('aria-label', ariaLabel);
    this.element.style.accentColor = `#${Theme.selectionColor.toString(16).padStart(6, '0')}`;
    this.element.style.margin = '0';
    this.element.style.cursor = 'pointer';
    this.commitHandler = null;
    this.element.addEventListener('click', () => this.commitHandler?.());
  }

  /**
   * Returns the input element.
   *
   * @returns Checkbox DOM node.
   */
  getElement(): HTMLInputElement {
    return this.element;
  }

  /**
   * Shows the shared state, or an indeterminate box when the values differ.
   *
   * @param values Per-object states.
   */
  setSharedValues(values: readonly boolean[]): void {
    const first = values[0] ?? false;
    this.element.indeterminate = values.some((value) => value !== first);
    this.element.checked = first;
  }

  /**
   * Returns whether the box is checked.
   *
   * @returns Current state.
   */
  getValue(): boolean {
    return this.element.checked;
  }

  /**
   * Binds the handler called when the user toggles the box by pointer or
   * keyboard.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.commitHandler = onCommit;
  }
}
