import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';

/** Editor of boolean fields: one checkbox. */
export class GameEntityFieldEditorBool extends GameEntityFieldEditor {
  private readonly input: InputCheckbox;

  /**
   * Creates the editor.
   *
   * @param field Boolean field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.input = new InputCheckbox(this.ariaLabel());
    this.input.bindCommit(() => {
      const checked = this.input.getValue();
      this.editCommit(() => checked);
    });
  }

  /**
   * Returns the checkbox.
   *
   * @returns Input element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows the shared state or an indeterminate box.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.input.setSharedValues(values.map((value) => value === true));
  }
}
