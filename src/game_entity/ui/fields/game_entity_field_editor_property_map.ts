import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputText } from '@/ui/input/input_text.js';
import { Theme } from '@/theme.js';

/** One property value. */
type GameEntityPropertyValue = string | number | boolean;

/**
 * Editor of free-form property maps: one name and value row per property, an
 * empty row to add one, and clearing a name removes its property. Values are
 * typed by their text: `true` and `false` are booleans, numbers are numbers,
 * anything else is text.
 */
export class GameEntityFieldEditorPropertyMap extends GameEntityFieldEditor {
  private readonly element: HTMLElement;
  private shownProperties: Record<string, GameEntityPropertyValue> = {};

  /**
   * Creates the editor.
   *
   * @param field Property map field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
  }

  /**
   * Returns the list element.
   *
   * @returns List element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the properties of the first object; a note tells when the objects
   * differ, and editing then gives every object the shown properties.
   *
   * @param values Per-object property maps.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.shownProperties = GameEntityFieldEditorPropertyMap.propertiesOf(values[0] ?? null);
    const first = JSON.stringify(this.shownProperties);
    const mixed = values.some(
      (value) => JSON.stringify(GameEntityFieldEditorPropertyMap.propertiesOf(value)) !== first,
    );
    this.element.replaceChildren();
    if (mixed) {
      this.element.appendChild(GameEntityFieldEditorPropertyMap.noteCreate('Mixed; editing replaces all'));
    }
    for (const [name, value] of Object.entries(this.shownProperties)) {
      this.element.appendChild(this.rowCreate(name, value));
    }
    this.element.appendChild(this.rowCreate('', ''));
  }

  /**
   * Creates one name and value row.
   *
   * @param name Property name; empty for the row that adds a property.
   * @param value Property value.
   * @returns Row element.
   */
  private rowCreate(name: string, value: GameEntityPropertyValue): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '4px';
    const nameInput = new InputText(`${this.ariaLabel()} name`);
    const valueInput = new InputText(`${this.ariaLabel()} value`);
    nameInput.setSharedValues([name]);
    valueInput.setSharedValues([String(value)]);
    const commit = (): void => this.rowCommit(name, nameInput.getValue(), valueInput.getValue());
    nameInput.bindCommit(commit);
    valueInput.bindCommit(commit);
    row.append(nameInput.getElement(), valueInput.getElement());
    return row;
  }

  /**
   * Commits one edited row as a whole new property map.
   *
   * @param previousName Name the row showed; empty for the adding row.
   * @param name Typed name; empty removes the property.
   * @param valueText Typed value.
   */
  private rowCommit(previousName: string, name: string, valueText: string): void {
    const trimmed = name.trim();
    if (previousName === '' && trimmed === '') {
      return;
    }
    const properties = { ...this.shownProperties };
    delete properties[previousName];
    if (trimmed !== '') {
      properties[trimmed] = GameEntityFieldEditorPropertyMap.valueParse(valueText);
    }
    this.editCommit(() => properties);
  }

  /**
   * Types a value by its text.
   *
   * @param text Typed value.
   * @returns Boolean, number or text.
   */
  static valueParse(text: string): GameEntityPropertyValue {
    if (text === 'true' || text === 'false') {
      return text === 'true';
    }
    const number = Number(text);
    return text.trim() !== '' && Number.isFinite(number) ? number : text;
  }

  /**
   * Reads a stored value as a property map.
   *
   * @param value Stored value.
   * @returns Properties; empty when the value is not a map.
   */
  private static propertiesOf(value: PreviewFieldValue): Record<string, GameEntityPropertyValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : {};
  }

  /**
   * Creates a small note line.
   *
   * @param text Note text.
   * @returns Note element.
   */
  private static noteCreate(text: string): HTMLElement {
    const note = document.createElement('span');
    note.textContent = text;
    note.style.color = Theme.statusBarTextColor;
    note.style.fontSize = '11px';
    return note;
  }
}
