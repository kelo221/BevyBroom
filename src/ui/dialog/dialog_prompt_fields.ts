import { dialogChromeCaptionApply } from './dialog_chrome_styles.js';
import { DialogModalChoice } from './dialog_modal_choice.js';
import { styleSettingsTextInput } from '@/ui/settings/settings_form_controls.js';

/** One text field of a prompt. */
export interface DialogPromptField {
  /** Key of the field's value in the answer. */
  readonly id: string;
  /** Caption above the field. */
  readonly label: string;
  /** Text the field starts with. */
  readonly value: string;
  /** Hint shown while the field is empty. */
  readonly placeholder: string;
  /** True when the prompt cannot be confirmed while the field is blank. */
  readonly isRequired: boolean;
  /** Values offered while typing, such as existing category names. */
  readonly suggestions: readonly string[];
}

/** What a text prompt asks. */
export interface DialogPromptFieldsOptions {
  /** Parent element that owns the modal overlay. */
  readonly host: HTMLElement;
  /** Dialog title. */
  readonly title: string;
  /** Fields in display order; the first one is focused. */
  readonly fields: readonly DialogPromptField[];
  /** Affirmative button label. */
  readonly confirmLabel: string;
}

/** Trimmed text of every field by field id. */
export type DialogPromptAnswer = Readonly<Record<string, string>>;

/** Smallest width of a prompt in pixels. */
const DIALOG_PROMPT_MIN_WIDTH_PX = 280;

/** Largest width of a prompt in pixels. */
const DIALOG_PROMPT_MAX_WIDTH_PX = 360;

/** Data attribute holding the field id on every prompt input. */
export const DIALOG_PROMPT_FIELD_ATTRIBUTE = 'data-prompt-field';

/**
 * Shows a small modal prompt with text fields. Enter confirms once every
 * required field holds text, Escape cancels.
 *
 * @param options Title, fields, label and host element.
 * @returns Trimmed field values, or null when cancelled.
 */
export function showPromptFields(options: DialogPromptFieldsOptions): Promise<DialogPromptAnswer | null> {
  return new Promise((resolve) => {
    const dialog = new DialogPromptFields(options, (answer) => {
      resolve(answer);
      queueMicrotask(() => dialog.dispose());
    });
    dialog.show();
  });
}

/** Modal prompt with one or more text fields. */
class DialogPromptFields extends DialogModalChoice {
  private readonly fields: readonly DialogPromptField[];
  private readonly inputs = new Map<string, HTMLInputElement>();

  /**
   * Creates the prompt.
   *
   * @param options Title, fields, label and host element.
   * @param settle Callback invoked once with the answer, or null when
   *   cancelled.
   */
  constructor(options: DialogPromptFieldsOptions, settle: (answer: DialogPromptAnswer | null) => void) {
    let answerRead: () => DialogPromptAnswer = () => ({});
    super(
      {
        host: options.host,
        title: options.title,
        confirmLabel: options.confirmLabel,
        cancelLabel: 'Cancel',
        minWidthPx: DIALOG_PROMPT_MIN_WIDTH_PX,
        maxWidthPx: DIALOG_PROMPT_MAX_WIDTH_PX,
      },
      (confirmed) => settle(confirmed ? answerRead() : null),
    );
    answerRead = () => this.answerRead();
    this.fields = options.fields;
    this.dialogBuild();
  }

  /**
   * Builds one captioned input per field.
   *
   * @returns Body element.
   */
  protected bodyCreate(): HTMLElement {
    const body = document.createElement('div');
    body.style.margin = '0 0 14px';
    this.fields.forEach((field) => body.appendChild(this.fieldRowCreate(field)));
    return body;
  }

  /**
   * Returns the first input, focused and selected when the prompt opens.
   *
   * @returns First input, or null without fields.
   */
  protected override focusTargetRead(): HTMLElement | null {
    const first = this.inputs.get(this.fields[0]?.id ?? '') ?? null;
    first?.select();
    return first;
  }

  /**
   * Returns whether every required field holds text.
   *
   * @returns True when the prompt may be confirmed.
   */
  protected override isConfirmAllowed(): boolean {
    return this.fields.every((field) => !field.isRequired || this.inputValueRead(field.id) !== '');
  }

  /**
   * Builds the caption and input of one field.
   *
   * @param field Field to show.
   * @returns Row element.
   */
  private fieldRowCreate(field: DialogPromptField): HTMLElement {
    const row = document.createElement('label');
    row.style.display = 'block';
    row.style.marginBottom = '8px';
    const caption = document.createElement('div');
    caption.textContent = field.label;
    dialogChromeCaptionApply(caption);
    row.append(caption, this.inputCreate(field));
    return row;
  }

  /**
   * Creates the input of one field, with a suggestion list when it has one.
   *
   * @param field Field to show.
   * @returns Input element.
   */
  private inputCreate(field: DialogPromptField): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = field.value;
    input.placeholder = field.placeholder;
    input.setAttribute(DIALOG_PROMPT_FIELD_ATTRIBUTE, field.id);
    styleSettingsTextInput(input);
    input.style.width = '100%';
    if (field.suggestions.length > 0) {
      input.setAttribute('list', this.suggestionListCreate(field).id);
    }
    this.inputs.set(field.id, input);
    return input;
  }

  /**
   * Creates the datalist offering a field's suggestions.
   *
   * @param field Field with suggestions.
   * @returns Datalist element, added to the dialog.
   */
  private suggestionListCreate(field: DialogPromptField): HTMLDataListElement {
    const list = document.createElement('datalist');
    list.id = `dialog-prompt-suggestions-${field.id}`;
    field.suggestions.forEach((suggestion) => {
      const option = document.createElement('option');
      option.value = suggestion;
      list.appendChild(option);
    });
    this.root.appendChild(list);
    return list;
  }

  /**
   * Returns the trimmed text of one field.
   *
   * @param fieldId Field id.
   * @returns Trimmed text, or empty for an unknown field.
   */
  private inputValueRead(fieldId: string): string {
    return this.inputs.get(fieldId)?.value.trim() ?? '';
  }

  /**
   * Returns the trimmed text of every field.
   *
   * @returns Answer by field id.
   */
  private answerRead(): DialogPromptAnswer {
    return Object.fromEntries(this.fields.map((field) => [field.id, this.inputValueRead(field.id)]));
  }
}
