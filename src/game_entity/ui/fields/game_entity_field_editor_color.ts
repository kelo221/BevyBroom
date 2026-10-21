import * as THREE from 'three';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { InputColor } from '@/ui/input/input_color.js';

/**
 * Editor of color fields: a swatch for the sRGB channels. Committing keeps each
 * object's alpha.
 */
export class GameEntityFieldEditorColor extends GameEntityFieldEditor {
  private readonly input: InputColor;

  /**
   * Creates the editor.
   *
   * @param field Color field.
   */
  constructor(field: GameEntityField) {
    super(field);
    this.input = new InputColor(this.ariaLabel());
    this.input.bindCommit(() => this.colorCommit());
  }

  /**
   * Returns the swatch.
   *
   * @returns Input element.
   */
  getElement(): HTMLElement {
    return this.input.getElement();
  }

  /**
   * Shows the shared color.
   *
   * @param values Per-object sRGB `[r, g, b, a]` values.
   */
  valuesShow(values: readonly PreviewFieldValue[]): void {
    this.input.setSharedValues(values.map((value) => GameEntityFieldEditorColor.hexOf(value)));
  }

  /** Commits the picked color with each object's alpha. */
  private colorCommit(): void {
    const hex = this.input.getHexValue();
    const red = ((hex >> 16) & 0xff) / 0xff;
    const green = ((hex >> 8) & 0xff) / 0xff;
    const blue = (hex & 0xff) / 0xff;
    this.editCommit((current) => [red, green, blue, Array.isArray(current) ? (current[3] ?? 1) : 1]);
  }

  /**
   * Converts a stored sRGB value to a 0xRRGGBB number.
   *
   * @param value Stored value.
   * @returns Color number, white when the value is not a color.
   */
  private static hexOf(value: PreviewFieldValue): number {
    if (!Array.isArray(value) || value.length < 3) {
      return 0xffffff;
    }
    const [red = 1, green = 1, blue = 1] = value;
    return new THREE.Color().setRGB(red, green, blue, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
  }
}
