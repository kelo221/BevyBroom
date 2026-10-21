import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Turns one object's current value of a field into the value the user
 * committed. Edits of a single vector component keep the other components of
 * each object.
 */
export type GameEntityFieldEdit = (current: PreviewFieldValue) => unknown;

/**
 * Editor of one game component field. It shows the values of every bound object
 * and reports commits as per-object edits.
 */
export abstract class GameEntityFieldEditor {
  protected readonly field: GameEntityField;
  private commitHandler: ((edit: GameEntityFieldEdit) => void) | null;

  /**
   * Creates the editor of a field.
   *
   * @param field Field description.
   */
  constructor(field: GameEntityField) {
    this.field = field;
    this.commitHandler = null;
  }

  /**
   * Returns the editor's root element.
   *
   * @returns Root DOM node.
   */
  abstract getElement(): HTMLElement;

  /**
   * Shows the effective values of every bound object.
   *
   * @param values Per-object values.
   */
  abstract valuesShow(values: readonly PreviewFieldValue[]): void;

  /**
   * Binds the handler that receives committed edits.
   *
   * @param onCommit Receives the per-object edit.
   */
  bindCommit(onCommit: (edit: GameEntityFieldEdit) => void): void {
    this.commitHandler = onCommit;
  }

  /**
   * Reports an edit to the bound handler.
   *
   * @param edit Per-object edit.
   */
  protected editCommit(edit: GameEntityFieldEdit): void {
    this.commitHandler?.(edit);
  }

  /**
   * Returns the accessible name of the editor's inputs.
   *
   * @returns Field label.
   */
  protected ariaLabel(): string {
    return this.field.label;
  }
}
