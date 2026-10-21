import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputText } from '@/ui/input/input_text.js';

/**
 * Editor of text fields, also used for asset paths when the game reported no
 * files to pick from.
 */
export class GameEntityFieldEditorText extends GameEntityFieldEditor {
  private readonly input: InputText;

  /**
   * Creates the editor.
   *
   * @param field Text or asset field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.input = new InputText(this.ariaLabel());
    this.input.bindCommit(() => this.textCommit());
  }

  /**
   * Returns the text input.
   *
   * @returns Input element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows the shared text or a mixed placeholder.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.input.setSharedValues(values.map((value) => (typeof value === 'string' ? value : '')));
  }

  /** Commits the typed text; an empty asset path clears the reference. */
  private textCommit(): void {
    const text = this.input.getValue();
    const value = this.field.kind === 'asset' && text.trim() === '' ? null : text;
    this.editCommit(() => value);
  }
}
