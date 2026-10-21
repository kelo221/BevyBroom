import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';

/** Select value standing for "no asset". */
const GAME_ENTITY_CHOICE_NONE_VALUE = '\u0000none';

/**
 * Editor of fields with a fixed set of values: enum variants, or the asset
 * files the game reported for an asset field. Asset fields also offer "None".
 */
export class GameEntityFieldEditorChoice extends GameEntityFieldEditor {
  private readonly input: InputSelect;
  private readonly values: readonly string[];

  /**
   * Creates the editor.
   *
   * @param field Enum or asset field.
   * @param values Selectable values: variant names or asset paths.
   */
  constructor(field: GameEntityField, values: readonly string[]) {
    super(field);
    this.values = values;
    this.input = new InputSelect([], this.ariaLabel());
    this.choicesShow([]);
    this.input.bindCommit(() => this.choiceCommit());
  }

  /**
   * Returns the select.
   *
   * @returns Select element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows the shared choice, listing values the objects use that are not
   * offered anymore.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    const selected = values.map((value) => (typeof value === 'string' ? value : GAME_ENTITY_CHOICE_NONE_VALUE));
    this.choicesShow(selected.filter((value) => value !== GAME_ENTITY_CHOICE_NONE_VALUE));
    this.input.setSharedValues(selected);
  }

  /**
   * Fills the select with the offered values plus extra values in use.
   *
   * @param valuesInUse Values the bound objects hold.
   */
  private choicesShow(valuesInUse: readonly string[]): void {
    const offered = [...new Set([...this.values, ...valuesInUse])];
    const choices: InputSelectChoice[] = offered.map((value) => ({ value, label: value }));
    if (this.field.kind === 'asset') {
      choices.unshift({ value: GAME_ENTITY_CHOICE_NONE_VALUE, label: 'None' });
    }
    this.input.setChoices(choices);
  }

  /** Commits the chosen value; "None" clears an asset reference. */
  private choiceCommit(): void {
    const chosen = this.input.getValue();
    if (chosen === '') {
      return;
    }
    const value = chosen === GAME_ENTITY_CHOICE_NONE_VALUE ? null : chosen;
    this.editCommit(() => value);
  }
}
