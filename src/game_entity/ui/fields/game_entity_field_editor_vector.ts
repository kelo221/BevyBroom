import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputVector } from '@/ui/input/input_vector.js';

/** Number of components of each vector field kind. */
const GAME_ENTITY_VECTOR_EDITOR_SIZES: Readonly<Record<string, number>> = { vector2: 2, vector3: 3, vector4: 4 };

/**
 * Editor of vector fields: one numeric field per component. Committing one
 * component keeps the other components of every object.
 */
export class GameEntityFieldEditorVector extends GameEntityFieldEditor {
  private readonly input: InputVector;
  private readonly size: number;

  /**
   * Creates the editor.
   *
   * @param field Vector field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.size = GAME_ENTITY_VECTOR_EDITOR_SIZES[field.kind] ?? 3;
    this.input = new InputVector(this.size, this.ariaLabel(), field.step ?? 0.1);
    this.input.bindCommit((index) => this.componentCommit(index));
  }

  /**
   * Returns the row of component fields.
   *
   * @returns Row element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows each component's shared value.
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.input.setSharedValues(
      values.map((value) => this.vectorOf(value)),
      2,
    );
  }

  /**
   * Commits one component of every object's vector.
   *
   * @param index Component index.
   */
  private componentCommit(index: number): void {
    const component = this.input.componentParse(index);
    if (component === null) {
      return;
    }
    this.editCommit((current) => {
      const vector = this.vectorOf(current);
      vector[index] = component;
      return vector;
    });
  }

  /**
   * Reads a stored value as a vector of this editor's size.
   *
   * @param value Stored value.
   * @returns Components, zero where missing.
   */
  private vectorOf(value: PreviewFieldValue): number[] {
    const source = Array.isArray(value) ? value : [];
    return Array.from({ length: this.size }, (_unused, index) => source[index] ?? 0);
  }
}
