import {
  PANEL_PROPERTIES_ROW_DATASET_KEY,
  PANEL_PROPERTIES_ROW_HELP_DATASET_KEY,
} from '@/ui/properties/panel_properties_row.js';

/** Field elements a keyvalue row edits its value with. */
type ObjectPropertiesKeyvalueRowField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * The selected row of the keyvalue table: its caption, its help text and the
 * field it edits its value with.
 */
export class ObjectPropertiesKeyvalueRowSelection {
  readonly row: HTMLElement;

  /**
   * Wraps a selected row.
   *
   * @param row Labeled field row.
   */
  constructor(row: HTMLElement) {
    this.row = row;
  }

  /**
   * Returns the row caption.
   *
   * @returns Caption text.
   */
  captionRead(): string {
    return this.row.dataset[PANEL_PROPERTIES_ROW_DATASET_KEY] ?? '';
  }

  /**
   * Returns the description of the row's field: its help text, else the
   * accessible name of its field.
   *
   * @returns Help text, or empty.
   */
  helpTextRead(): string {
    const helpText = this.row.dataset[PANEL_PROPERTIES_ROW_HELP_DATASET_KEY];
    return helpText ?? this.fieldRead()?.getAttribute('aria-label') ?? '';
  }

  /**
   * Returns the value the row's field shows.
   *
   * @returns Value text, or empty without a field.
   */
  valueRead(): string {
    return this.fieldRead()?.value ?? '';
  }

  /**
   * Writes text into the row's field and commits it the way typing would.
   *
   * @param text Value text.
   */
  valueWrite(text: string): void {
    const field = this.fieldRead();
    if (!field) {
      return;
    }
    field.value = text;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Returns the first field of the row.
   *
   * @returns Field element, or null when the row has none.
   */
  private fieldRead(): ObjectPropertiesKeyvalueRowField | null {
    return this.row.querySelector<ObjectPropertiesKeyvalueRowField>('input, select, textarea');
  }
}
