import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { Theme } from '@/theme.js';

/**
 * Shows a value the editor cannot change: fields the game could not describe,
 * and fields of classes the game does not report.
 */
export class GameEntityFieldEditorReadonly extends GameEntityFieldEditor {
  private readonly element: HTMLElement;

  /**
   * Creates the read-only view.
   *
   * @param field Field description.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.element = document.createElement('span');
    this.element.style.color = Theme.statusBarTextColor;
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '11px';
    this.element.style.overflow = 'hidden';
    this.element.style.textOverflow = 'ellipsis';
    this.element.style.whiteSpace = 'nowrap';
  }

  /**
   * Returns the text element.
   *
   * @returns Text element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the shared value as JSON, or "Mixed".
   *
   * @param values Per-object values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    const texts = values.map((value) => (value === null ? 'game default' : JSON.stringify(value)));
    const first = texts[0] ?? '';
    this.element.textContent = texts.every((text) => text === first) ? first : 'Mixed';
    this.element.title = this.element.textContent;
  }
}
