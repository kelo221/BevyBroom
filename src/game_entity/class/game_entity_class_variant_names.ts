import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';

/**
 * Names and groups the values of a game class field the way the class file
 * describes them in the field's variant details, falling back to readable names
 * made from the values themselves.
 */
export class GameEntityClassVariantNames {
  /**
   * Returns the display name of one field value.
   *
   * @param field Field the value belongs to.
   * @param valueText Field value as text.
   * @returns The variant's label, or a readable name made from the value.
   */
  static labelOf(field: GameEntityField, valueText: string): string {
    return field.variant_details?.[valueText]?.label ?? GameEntityClassVariantNames.labelFromValue(valueText);
  }

  /**
   * Returns the group one field value is listed in.
   *
   * @param field Field the value belongs to.
   * @param valueText Field value as text.
   * @returns The variant's group, or null when the class file names none.
   */
  static groupOf(field: GameEntityField, valueText: string): string | null {
    return field.variant_details?.[valueText]?.group ?? null;
  }

  /**
   * Returns a readable name for a field value without a display name, such as
   * "Shelf tall 4" for `shelf-tall-4`.
   *
   * @param valueText Field value as text.
   * @returns Readable name.
   */
  static labelFromValue(valueText: string): string {
    const words = valueText
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
