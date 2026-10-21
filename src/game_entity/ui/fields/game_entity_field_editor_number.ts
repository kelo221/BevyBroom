import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';

/** Editor of number and integer fields: one numeric field accepting math. */
export class GameEntityFieldEditorNumber extends GameEntityFieldEditor {
  private readonly input: InputNumeric;

  /**
   * Creates the editor.
   *
   * @param field Number or integer field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.input = new InputNumeric({ step: field.step ?? (field.kind === 'integer' ? 1 : 0.1), width: '100%' });
    this.input.getElement().setAttribute('aria-label', this.ariaLabel());
    this.input.bindCommit(() => this.numberCommit());
  }

  /**
   * Returns the numeric input.
   *
   * @returns Input element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows the shared number or a mixed marker.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    const numbers = values.map((value) => (typeof value === 'number' ? value : 0));
    this.input.setSharedValues(numbers, this.field.kind === 'integer' ? 0 : 2);
  }

  /** Commits the typed number, ignoring text that is not a number. */
  private numberCommit(): void {
    const value = this.input.parseNumberOrNull();
    if (value !== null) {
      this.editCommit(() => value);
    }
  }
}
