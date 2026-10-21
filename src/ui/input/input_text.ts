import { Theme } from '@/theme.js';

/** Placeholder shown while the bound objects disagree. */
const INPUT_TEXT_MIXED_PLACEHOLDER = 'Mixed';

/** Themed single-line text field used by inspector rows. */
export class InputText {
  private readonly element: HTMLInputElement;
  private commitHandler: (() => void) | null;

  /**
   * Creates a text field.
   *
   * @param ariaLabel Accessible name.
   */
  constructor(ariaLabel: string) {
    this.element = document.createElement('input');
    this.element.type = 'text';
    this.element.setAttribute('aria-label', ariaLabel);
    this.commitHandler = null;
    this.applyChrome();
    this.element.addEventListener('change', () => this.commitHandler?.());
    this.element.addEventListener('keydown', (event) => this.handleEnterBlur(event));
  }

  /**
   * Returns the input element.
   *
   * @returns Text input DOM node.
   */
  getElement(): HTMLInputElement {
    return this.element;
  }

  /**
   * Shows the shared text, or a blank field with a mixed placeholder when the
   * values differ.
   *
   * @param values Per-object texts.
   */
  setSharedValues(values: readonly string[]): void {
    const first = values[0] ?? '';
    const mixed = values.some((value) => value !== first);
    this.element.value = mixed ? '' : first;
    this.element.placeholder = mixed ? INPUT_TEXT_MIXED_PLACEHOLDER : '';
  }

  /**
   * Returns the typed text.
   *
   * @returns Current text.
   */
  getValue(): string {
    return this.element.value;
  }

  /**
   * Binds the handler called when the user commits the text.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.commitHandler = onCommit;
  }

  /**
   * Commits by leaving the field when Enter is pressed.
   *
   * @param event Key event.
   */
  private handleEnterBlur(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.element.blur();
    }
  }

  /** Applies the inspector input chrome. */
  private applyChrome(): void {
    this.element.style.boxSizing = 'border-box';
    this.element.style.height = '24px';
    this.element.style.padding = '0 6px';
    this.element.style.borderRadius = '2px';
    this.element.style.border = `1px solid ${Theme.inputBorderColor}`;
    this.element.style.background = Theme.inputBackgroundColor;
    this.element.style.color = Theme.inputTextColor;
    this.element.style.fontFamily = Theme.uiFontFamily;
    this.element.style.fontSize = '12px';
    this.element.style.outline = 'none';
    this.element.style.minWidth = '0';
  }
}
