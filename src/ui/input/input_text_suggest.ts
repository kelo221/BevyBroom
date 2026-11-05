import { Theme } from '@/theme.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { MenuContext } from '@/ui/menu/menu_context.js';
import { InputText } from './input_text.js';
import type { InputSelectChoice } from './input_select.js';

/** Counter that keeps the suggestion list ids of a document unique. */
let inputTextSuggestListCounter = 0;

/** Width of the drop-down arrow button in pixels. */
const INPUT_TEXT_SUGGEST_ARROW_WIDTH_PX = 18;

/** Height of the field and its drop-down arrow button in pixels. */
const INPUT_TEXT_SUGGEST_HEIGHT_PX = 24;

/** Id of the style element that hides the browser's own suggestion arrow. */
const INPUT_TEXT_SUGGEST_STYLE_ELEMENT_ID = 'bevybroom-input-text-suggest-styles';

/**
 * Injects, once, the CSS that hides the browser's own suggestion arrow so only
 * the combo's arrow button shows.
 *
 * @param ownerDocument Document that hosts the combo.
 */
function inputTextSuggestStylesEnsure(ownerDocument: Document): void {
  if (ownerDocument.getElementById(INPUT_TEXT_SUGGEST_STYLE_ELEMENT_ID)) {
    return;
  }
  const styleElement = ownerDocument.createElement('style');
  styleElement.id = INPUT_TEXT_SUGGEST_STYLE_ELEMENT_ID;
  styleElement.textContent =
    '.input-text-suggest > input::-webkit-calendar-picker-indicator { display: none !important; }';
  ownerDocument.head.appendChild(styleElement);
}

/**
 * Themed combo box: a text field with a drop-down arrow that lists every
 * suggested value. The user picks a suggestion or types any other text.
 */
export class InputTextSuggest {
  private readonly text: InputText;
  private readonly suggestionList: HTMLDataListElement;
  private readonly arrowButton: HTMLButtonElement;
  private readonly wrapper: HTMLElement;
  private suggestionMenu: MenuContext | null;

  /**
   * Creates the field with an empty suggestion list.
   *
   * @param ariaLabel Accessible name.
   */
  constructor(ariaLabel: string) {
    this.text = new InputText(ariaLabel);
    this.suggestionMenu = null;
    this.suggestionList = this.suggestionListCreate();
    this.arrowButton = this.arrowButtonCreate(ariaLabel);
    this.wrapper = this.wrapperCreate();
  }

  /**
   * Returns the element holding the field, its arrow and its suggestion list.
   *
   * @returns Wrapper element.
   */
  getElement(): HTMLElement {
    return this.wrapper;
  }

  /**
   * Returns the text input.
   *
   * @returns Input element.
   */
  inputElementRead(): HTMLInputElement {
    return this.text.getElement();
  }

  /**
   * Returns the drop-down arrow button.
   *
   * @returns Arrow button element.
   */
  arrowButtonRead(): HTMLButtonElement {
    return this.arrowButton;
  }

  /**
   * Replaces the suggested values.
   *
   * @param choices Suggestions; the label is shown next to the value.
   */
  suggestionsWrite(choices: readonly InputSelectChoice[]): void {
    this.suggestionList.replaceChildren(...choices.map((choice) => this.suggestionOptionCreate(choice)));
  }

  /**
   * Returns the suggested values in order.
   *
   * @returns Suggested values.
   */
  suggestionsRead(): string[] {
    return Array.from(this.suggestionList.options, (option) => option.value);
  }

  /**
   * Shows the shared text, or a blank field with a mixed placeholder.
   *
   * @param values Per-object texts.
   */
  setSharedValues(values: readonly string[]): void {
    this.text.setSharedValues(values);
  }

  /**
   * Returns the typed or picked text.
   *
   * @returns Current text.
   */
  getValue(): string {
    return this.text.getValue();
  }

  /**
   * Binds the handler called when the user commits the text.
   *
   * @param onCommit Commit handler.
   */
  bindCommit(onCommit: () => void): void {
    this.text.bindCommit(onCommit);
  }

  /**
   * Puts a suggestion into the field and commits it like typed text.
   *
   * @param value Suggested value.
   */
  suggestionPick(value: string): void {
    this.text.getElement().value = value;
    this.text.getElement().dispatchEvent(new Event('change'));
  }

  /**
   * Creates the suggestion list the field links to.
   *
   * @returns Data list element.
   */
  private suggestionListCreate(): HTMLDataListElement {
    const list = document.createElement('datalist');
    inputTextSuggestListCounter += 1;
    list.id = `input-text-suggest-${inputTextSuggestListCounter}`;
    this.text.getElement().setAttribute('list', list.id);
    return list;
  }

  /**
   * Creates the arrow button that opens the list of every suggestion, joined to
   * the right edge of the field.
   *
   * @param ariaLabel Accessible name of the field.
   * @returns Arrow button.
   */
  private arrowButtonCreate(ariaLabel: string): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: `Choose ${ariaLabel}`,
      text: '▾',
      widthPx: INPUT_TEXT_SUGGEST_ARROW_WIDTH_PX,
      heightPx: INPUT_TEXT_SUGGEST_HEIGHT_PX,
      onClick: () => this.suggestionMenuOpen(),
    });
    button.classList.add('input-text-suggest-arrow');
    button.tabIndex = -1;
    button.style.borderLeft = 'none';
    button.style.borderRadius = '0 2px 2px 0';
    button.style.color = Theme.statusBarTextColor;
    return button;
  }

  /**
   * Creates the wrapper with the field and its arrow side by side.
   *
   * @returns Wrapper element.
   */
  private wrapperCreate(): HTMLElement {
    inputTextSuggestStylesEnsure(document);
    const wrapper = document.createElement('span');
    wrapper.classList.add('input-text-suggest');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.minWidth = '0';
    const input = this.text.getElement();
    input.style.flex = '1';
    input.style.height = `${INPUT_TEXT_SUGGEST_HEIGHT_PX}px`;
    input.style.borderRadius = '2px 0 0 2px';
    wrapper.append(input, this.arrowButton, this.suggestionList);
    return wrapper;
  }

  /** Opens the list of every suggestion under the field. */
  private suggestionMenuOpen(): void {
    this.suggestionMenu?.dispose();
    const values = this.suggestionsRead();
    if (values.length === 0 || this.text.getElement().disabled) {
      this.suggestionMenu = null;
      return;
    }
    this.suggestionMenu = new MenuContext(
      this.wrapper,
      values.map((value) => ({ label: value, callback: () => this.suggestionPick(value) })),
    );
    const bounds = this.wrapper.getBoundingClientRect();
    this.suggestionMenu.show(bounds.left, bounds.bottom);
  }

  /**
   * Creates one suggestion entry.
   *
   * @param choice Suggested value and its label.
   * @returns Option element.
   */
  private suggestionOptionCreate(choice: InputSelectChoice): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = choice.value;
    if (choice.label !== choice.value) {
      option.label = choice.label;
    }
    if (choice.title) {
      option.title = choice.title;
    }
    return option;
  }
}
